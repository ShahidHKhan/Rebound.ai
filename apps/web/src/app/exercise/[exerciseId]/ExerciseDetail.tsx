"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc/client";

const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
};
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const tagStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #ddd",
  borderRadius: 20,
  padding: "0.15rem 0.6rem",
  marginRight: "0.4rem",
  marginBottom: "0.4rem",
  fontSize: "0.85rem",
};
const imageStyle: React.CSSProperties = { maxWidth: "100%", borderRadius: 8, marginBottom: "0.75rem" };

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

// The Free Exercise DB seed script (packages/db/scripts/seed-exercises.ts)
// stores media as { instructions: string[], images: string[] } — but media
// is a nullable Json column with no schema guarantee, so this reads it
// defensively rather than trusting the shape.
function readMedia(media: unknown): { instructions: string[]; images: string[] } {
  if (!media || typeof media !== "object") return { instructions: [], images: [] };
  const m = media as Record<string, unknown>;
  const instructions = Array.isArray(m.instructions) ? m.instructions.filter((i): i is string => typeof i === "string") : [];
  const images = Array.isArray(m.images) ? m.images.filter((i): i is string => typeof i === "string") : [];
  return { instructions, images };
}

export function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const exerciseQuery = trpc.exercise.getById.useQuery({ exerciseId });

  if (exerciseQuery.isLoading) {
    return (
      <main style={pageStyle}>
        <p>
          <span className="spinner" aria-hidden="true" /> Loading exercise…
        </p>
      </main>
    );
  }

  if (exerciseQuery.isError || !exerciseQuery.data) {
    return (
      <main style={pageStyle}>
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load this exercise: {exerciseQuery.error?.message}
        </p>
        <p>
          <Link href="/today" style={linkStyle}>
            ← Back to Today
          </Link>
        </p>
      </main>
    );
  }

  const exercise = exerciseQuery.data;
  const { instructions, images } = readMedia(exercise.media);

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/today" style={linkStyle}>
          ← Back to Today
        </Link>
      </p>
      <h1>{exercise.name}</h1>

      <div style={cardStyle}>
        <p>
          <strong>Category:</strong> {exercise.category.toLowerCase()}
        </p>
        <p>
          <strong>Difficulty:</strong> {exercise.difficultyLevel}
        </p>
        {exercise.targetMuscleGroups.length > 0 && (
          <div style={{ marginTop: "0.5rem" }}>
            <strong>Target muscle groups:</strong>
            <div style={{ marginTop: "0.4rem" }}>
              {exercise.targetMuscleGroups.map((m) => (
                <span key={m} style={tagStyle}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {exercise.contraindications.length > 0 && (
          <div style={{ marginTop: "0.5rem" }}>
            <strong>Contraindications:</strong>
            <div style={{ marginTop: "0.4rem" }}>
              {exercise.contraindications.map((c) => (
                <span key={c} style={tagStyle}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div style={cardStyle}>
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized source
            <img key={img} src={`${IMAGE_BASE}${img}`} alt={exercise.name} style={imageStyle} />
          ))}
        </div>
      )}

      {instructions.length > 0 && (
        <div style={cardStyle}>
          <h2>Instructions</h2>
          <ol>
            {instructions.map((step, i) => (
              <li key={i} style={{ marginBottom: "0.4rem" }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      <p style={{ color: "#666", fontSize: "0.85rem" }}>Source: {exercise.source}</p>
    </main>
  );
}
