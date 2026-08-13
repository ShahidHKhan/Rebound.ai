import { RegimeReview } from "./RegimeReview";

export default async function RegimeReviewPage({ params }: PageProps<"/regime/[regimeId]">) {
  const { regimeId } = await params;
  return <RegimeReview regimeId={regimeId} />;
}
