import { ExerciseDetail } from "./ExerciseDetail";

export default async function ExerciseDetailPage({ params }: PageProps<"/exercise/[exerciseId]">) {
  const { exerciseId } = await params;
  return <ExerciseDetail exerciseId={exerciseId} />;
}
