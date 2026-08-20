import { prisma } from "@rebound/db";
import type { GoalType, Preset, PresetSlot, RiskTier } from "@rebound/db";

export interface SkeletonRetrievalContext {
  goalType: GoalType;
  riskTier: RiskTier;
  targetMovement: string;
  symptomsText: string;
}

export type SkeletonWithSlots = Preset & { slots: PresetSlot[] };

// Structured filter, no embeddings: goalType x riskTier narrows to a small
// candidate set (the skeleton library is hand-authored, not large enough to
// need semantic retrieval — see HANDOFF's Flow A/B research session), then
// bodyRegionTags is keyword-matched against the free-text targetMovement +
// symptomsText fields, since targetMovement isn't itself an enum.
export async function findSkeletonPreset(
  context: SkeletonRetrievalContext
): Promise<SkeletonWithSlots | null> {
  const candidates = await prisma.preset.findMany({
    where: { kind: "SKELETON", goalType: context.goalType, riskTier: context.riskTier },
    include: { slots: { orderBy: { orderIndex: "asc" } } },
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const haystack = `${context.targetMovement} ${context.symptomsText}`.toLowerCase();
  const scored = candidates.map((preset) => ({
    preset,
    score: preset.bodyRegionTags.filter((tag) => haystack.includes(tag.replace(/_/g, " ").toLowerCase()))
      .length,
  }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  if (best.score > 0) return best.preset;

  // No region-tag match — an explicitly "general" skeleton is a safe
  // default among the goalType/riskTier candidates. Without one, the
  // remaining candidates are body-region-specific (e.g. lbp vs. shoulder)
  // and none fit this user, so there's no confident choice: return null
  // rather than arbitrarily picking the first one and pretending it matched.
  return candidates.find((preset) => preset.bodyRegionTags.includes("general")) ?? null;
}
