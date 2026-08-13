import type { EscalationAction, EscalationResult, RiskTier, SessionLogEntry } from "./types";

type PainColor = "green" | "yellow" | "red";

function painColor(score: number): PainColor {
  if (score >= 7) return "red";
  if (score >= 4) return "yellow";
  return "green";
}

const HEAVIER_TIER: RiskTier = "HEAVIER_CHRONIC_ELDERLY";

const ACTION_SEVERITY: Record<EscalationAction, number> = {
  none: 0,
  flag_for_review: 1,
  hold: 2,
  rollback: 3,
};

// Reasons only ever reflect the currently-winning action: a lower-severity
// signal that fires before a higher one is superseded, not appended.
function escalate(current: EscalationResult, action: EscalationAction, reason: string): EscalationResult {
  const currentSeverity = ACTION_SEVERITY[current.action];
  const newSeverity = ACTION_SEVERITY[action];

  if (newSeverity > currentSeverity) {
    return { action, reasons: [reason] };
  }
  if (newSeverity === currentSeverity && action === current.action) {
    return { action, reasons: [...current.reasons, reason] };
  }
  return current;
}

// Runs on every Session Log write, real-time and decoupled from Flow B's
// cadence (Clinical Risk Framing > Escalation monitor). recentLogs is
// most-recent-first; index 0 is the log that was just written and triggered
// this check. At least 3 entries are needed to evaluate the general/light
// tiers' "repeats 2 days running" / "2 consecutive occurrences" signals —
// with fewer, those signals simply can't fire yet.
export function checkEscalation(recentLogs: SessionLogEntry[], riskTier: RiskTier): EscalationResult {
  let result: EscalationResult = { action: "none", reasons: [] };

  const today = recentLogs[0];
  if (!today) return result;

  const yesterday = recentLogs[1];
  const dayBefore = recentLogs[2];

  if (painColor(today.painScore) === "red") {
    result = escalate(result, "rollback", "single log, pain red (7-10)");
  }

  if (today.madeItWorseFlag) {
    result = escalate(result, "rollback", '"made it worse" flag = true');
  }

  if (yesterday) {
    if (today.painScore - yesterday.painScore >= 2) {
      if (riskTier === HEAVIER_TIER) {
        result = escalate(
          result,
          "rollback",
          "day-over-day pain jump >= 2 pts (heavier tier: rollback on first occurrence)"
        );
      } else {
        const jumpedYesterdayToo = dayBefore ? yesterday.painScore - dayBefore.painScore >= 2 : false;
        result = jumpedYesterdayToo
          ? escalate(result, "rollback", "day-over-day pain jump >= 2 pts, repeated 2 days running")
          : escalate(result, "flag_for_review", "day-over-day pain jump >= 2 pts");
      }
    }

    const notSettledToday = painColor(yesterday.painScore) === "yellow" && painColor(today.painScore) !== "green";

    if (notSettledToday) {
      if (riskTier === HEAVIER_TIER) {
        result = escalate(
          result,
          "rollback",
          "yellow pain not settled to green by next morning (heavier tier: rollback on first occurrence)"
        );
      } else {
        const notSettledYesterdayToo = dayBefore
          ? painColor(dayBefore.painScore) === "yellow" && painColor(yesterday.painScore) !== "green"
          : false;
        result = notSettledYesterdayToo
          ? escalate(result, "rollback", "yellow pain not settled to green, 2 consecutive occurrences")
          : escalate(result, "hold", "yellow pain not settled to green by next morning");
      }
    }
  }

  return result;
}
