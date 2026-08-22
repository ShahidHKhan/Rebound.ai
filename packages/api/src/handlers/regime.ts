import { validateRegime, validateStructure } from "@rebound/clinical-rules";
import type { DraftRegime } from "@rebound/clinical-rules";

import type {
  ActivateRegimeInput,
  ActivateRegimeResponse,
  ExerciseMedia,
  RegimeResponse,
  RestartRegimeInput,
  RestartRegimeResponse,
} from "@rebound/contracts";

import type { Prisma } from "@rebound/db";

import { computeSessionTimes, startOfToday } from "../date-utils";
import { ApiError } from "../errors";

type Ctx = { prisma: Prisma.TransactionClient; userId: string };

// Shared with handlers/workout-session.ts's `today` — both queries include
// { exerciseList: { include: { exercise: true } } } and need the exact same
// media narrowing (see handlers/exercise.ts's getExerciseById).
export function toRegimeExerciseListResponse(
  exerciseList: Prisma.RegimeExerciseGetPayload<{ include: { exercise: true } }>[]
) {
  return exerciseList.map((e) => ({
    ...e,
    exercise: { ...e.exercise, media: e.exercise.media as ExerciseMedia },
  }));
}

function toRegimeResponse(
  regime: Prisma.RegimeGetPayload<{
    include: {
      exerciseList: { include: { exercise: true } };
      sourcePreset: { include: { slots: true } };
    };
  }>
): RegimeResponse {
  return {
    id: regime.id,
    userId: regime.userId,
    versionNumber: regime.versionNumber,
    createdAt: regime.createdAt.toISOString(),
    createdBy: regime.createdBy,
    status: regime.status,
    endReason: regime.endReason,
    sourcePresetId: regime.sourcePresetId,
    sourcePreset: regime.sourcePreset
      ? {
          id: regime.sourcePreset.id,
          name: regime.sourcePreset.name,
          description: regime.sourcePreset.description,
          riskTier: regime.sourcePreset.riskTier,
          createdAt: regime.sourcePreset.createdAt.toISOString(),
          kind: regime.sourcePreset.kind,
          goalType: regime.sourcePreset.goalType,
          bodyRegionTags: regime.sourcePreset.bodyRegionTags,
          slots: regime.sourcePreset.slots,
        }
      : null,
    parentRegimeId: regime.parentRegimeId,
    exerciseList: toRegimeExerciseListResponse(regime.exerciseList),
  };
}

// Exercise is shared library content, not user-owned — no ownership check on
// it. The regime itself is, though: mirrors packages/api/src/routers/regime.ts's
// getById exactly.
export async function getRegimeById(ctx: Ctx, input: { regimeId: string }): Promise<RegimeResponse> {
  const regime = await ctx.prisma.regime.findUniqueOrThrow({
    where: { id: input.regimeId },
    include: {
      exerciseList: { orderBy: { orderIndex: "asc" }, include: { exercise: true } },
      sourcePreset: { include: { slots: { orderBy: { orderIndex: "asc" } } } },
    },
  });

  if (regime.userId !== ctx.userId) {
    throw new ApiError("FORBIDDEN");
  }

  return toRegimeResponse(regime);
}

// Mirrors packages/api/src/routers/regime.ts's activate exactly — same
// DRAFT-only guard, same structural-then-clinical validation order and
// error-message shapes, same defensive supersede-other-ACTIVE-regimes
// update, same today's-WorkoutSession-rows creation.
export async function activateRegime(
  ctx: Ctx,
  input: { regimeId: string } & ActivateRegimeInput
): Promise<ActivateRegimeResponse> {
  const regime = await ctx.prisma.regime.findUniqueOrThrow({
    where: { id: input.regimeId },
    include: { exerciseList: true },
  });

  if (regime.userId !== ctx.userId) {
    throw new ApiError("FORBIDDEN");
  }
  if (regime.status !== "DRAFT") {
    throw new ApiError("BAD_REQUEST", `Regime is already ${regime.status}, not DRAFT`);
  }

  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });

  const finalExercises =
    input.exercises ??
    regime.exerciseList.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets ?? undefined,
      reps: e.reps ?? undefined,
      durationSeconds: e.durationSeconds ?? undefined,
      frequency: e.frequency ?? undefined,
      sessionSlot: e.sessionSlot,
    }));

  if (input.exercises) {
    const draft: DraftRegime = { exercises: finalExercises };
    const structural = validateStructure(draft);
    if (!structural.success) {
      throw new ApiError("BAD_REQUEST", `Structural validation failed: ${JSON.stringify(structural.error.issues)}`);
    }
    const clinical = validateRegime(draft, user.riskTier);
    if (!clinical.valid) {
      throw new ApiError("BAD_REQUEST", `Clinical validation failed: ${clinical.issues.map((i) => i.message).join("; ")}`);
    }
  }

  const today = startOfToday();

  // No inner $transaction here — ctx.prisma is already a transaction client
  // for the whole request (withAuth's RLS transaction, apps/web/src/lib/rest/with-auth.ts),
  // so these writes are already atomic without nesting one.
  if (input.exercises) {
    await ctx.prisma.regimeExercise.deleteMany({ where: { regimeId: regime.id } });
  }

  // Defensive: without this, activating a second draft while one regime is
  // already ACTIVE leaves two ACTIVE rows for the same user — see the tRPC
  // version's comment for the full reasoning (real, reachable bug, not
  // hypothetical).
  await ctx.prisma.regime.updateMany({
    where: { userId: ctx.userId, status: "ACTIVE", id: { not: regime.id } },
    data: { status: "SUPERSEDED" },
  });

  const updated = await ctx.prisma.regime.update({
    where: { id: regime.id },
    data: {
      status: "ACTIVE",
      createdBy: input.exercises ? "USER_EDITED" : regime.createdBy,
      ...(input.exercises
        ? {
            exerciseList: {
              create: finalExercises.map((exercise, index) => ({
                exerciseId: exercise.exerciseId,
                sets: exercise.sets,
                reps: exercise.reps,
                durationSeconds: exercise.durationSeconds,
                frequency: exercise.frequency,
                sessionSlot: exercise.sessionSlot,
                orderIndex: index,
              })),
            },
          }
        : {}),
    },
    include: { exerciseList: true },
  });

  const { morningTime, eveningTime } = computeSessionTimes(today, user.wakeTimeMinutes, user.eveningTimeMinutes);

  await ctx.prisma.workoutSession.createMany({
    data: [
      { userId: ctx.userId, regimeVersionId: updated.id, date: today, slot: "MORNING", scheduledAt: morningTime },
      { userId: ctx.userId, regimeVersionId: updated.id, date: today, slot: "EVENING", scheduledAt: eveningTime },
    ],
    skipDuplicates: true,
  });

  return { regimeId: updated.id, exerciseCount: updated.exerciseList.length };
}

// Self-service "start over" — ends the user's active regime (kept in
// history, not deleted) so they can go through onboarding again. Ending it
// explicitly is also what clears onboarding.submit's regime-generation
// cooldown immediately, rather than making them wait out the 7 days.
export async function restartRegime(ctx: Ctx, input: RestartRegimeInput): Promise<RestartRegimeResponse> {
  const activeRegime = await ctx.prisma.regime.findFirst({
    where: { userId: ctx.userId, status: "ACTIVE" },
  });

  if (!activeRegime) {
    throw new ApiError("BAD_REQUEST", "No active regime to restart.");
  }

  const endReason = input.comment ? `${input.reasonCode}: ${input.comment}` : input.reasonCode;

  await ctx.prisma.regime.update({
    where: { id: activeRegime.id },
    data: { status: "ENDED", endReason },
  });

  return { success: true as const };
}
