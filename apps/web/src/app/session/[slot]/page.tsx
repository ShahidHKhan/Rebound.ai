import { notFound } from "next/navigation";

import { GuidedSession } from "./GuidedSession";

export default async function GuidedSessionPage({ params }: PageProps<"/session/[slot]">) {
  const { slot } = await params;
  if (slot !== "MORNING" && slot !== "EVENING") notFound();

  return <GuidedSession slot={slot} />;
}
