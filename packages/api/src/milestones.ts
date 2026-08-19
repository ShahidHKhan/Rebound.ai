// Pure, derived-only "achievement" computation for the Milestones screen —
// nothing here is persisted (no schema changes allowed for this feature).
// Every milestone is recomputed on the fly from data that already exists
// (streak, weeks active, pain trend), same spirit as streak.ts's pure
// computeCurrentStreak.

export interface MilestonesInput {
  streak: number;
  weeksActive: number;
  // Ascending by date — same shape progress.summary's painTrend returns.
  painTrend: { date: string; painScore: number }[];
}

export interface Milestone {
  id: string;
  label: string;
  description: string;
}

// Thresholds are display-only judgment calls, not clinical/product-specified
// values — chosen to mirror common streak-app conventions (Duolingo-style).
const STREAK_THRESHOLDS = [3, 7, 14, 30, 60, 100];

// How many of the most recent pain logs to average for the "since you
// started" comparison, so a single noisy/off day doesn't swing the headline.
const RECENT_PAIN_WINDOW = 3;

export function computeMilestones(input: MilestonesInput): Milestone[] {
  const milestones: Milestone[] = [];

  if (input.weeksActive >= 1) {
    milestones.push({
      id: "first-week",
      label: "First week complete",
      description: "You've stuck with your regime for a full week.",
    });
  }

  for (const threshold of STREAK_THRESHOLDS) {
    if (input.streak >= threshold) {
      milestones.push({
        id: `streak-${threshold}`,
        label: `${threshold}-day streak`,
        description: `You've completed at least one session ${threshold} days in a row.`,
      });
    }
  }

  const firstPainEntry = input.painTrend[0];
  if (firstPainEntry && input.painTrend.length >= 2) {
    const first = firstPainEntry.painScore;
    const recentWindow = input.painTrend.slice(-RECENT_PAIN_WINDOW);
    const recentAvg = recentWindow.reduce((sum, p) => sum + p.painScore, 0) / recentWindow.length;
    const delta = Math.round(first - recentAvg);

    if (delta >= 1) {
      milestones.push({
        id: "pain-down",
        label: `Pain score down ${delta} point${delta === 1 ? "" : "s"} since you started`,
        description: "Your reported pain has trended down since your first check-in.",
      });
    }
  }

  return milestones;
}
