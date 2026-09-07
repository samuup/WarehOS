export const MS_PER_DAY = 86400000;
export const DEFAULT_TRIAL_DAYS = 30;

export interface TrialComputation {
  trialDaysLeft: number;
  expired: boolean;
}

export function computeTrialStatus(input: {
  firstRunMs: number;
  nowMs: number;
  trialDays: number;
}): TrialComputation {
  const msLeft = input.firstRunMs + input.trialDays * MS_PER_DAY - input.nowMs;
  return {
    trialDaysLeft: Math.max(0, Math.ceil(msLeft / MS_PER_DAY)),
    expired: msLeft <= 0,
  };
}