import { describe, it, expect } from 'vitest';
import { computeTrialStatus, DEFAULT_TRIAL_DAYS, MS_PER_DAY } from '../../shared/trialLogic';

function firstRun() {
  return 1_700_000_000_000;
}

describe('computeTrialStatus', () => {
  it('devuelve la cantidad de días completos restantes', () => {
    const res = computeTrialStatus({
      firstRunMs: firstRun(),
      nowMs: firstRun() + 10 * MS_PER_DAY,
      trialDays: DEFAULT_TRIAL_DAYS,
    });
    expect(res.trialDaysLeft).toBe(5);
    expect(res.expired).toBe(false);
  });

  it('redondea hacia arriba un día fraccional restante', () => {
    const res = computeTrialStatus({
      firstRunMs: firstRun(),
      nowMs: firstRun() + 14.1 * MS_PER_DAY,
      trialDays: DEFAULT_TRIAL_DAYS,
    });
    expect(res.trialDaysLeft).toBe(1);
    expect(res.expired).toBe(false);
  });

  it('marca como vencido al llegar al final del periodo', () => {
    const res = computeTrialStatus({
      firstRunMs: firstRun(),
      nowMs: firstRun() + DEFAULT_TRIAL_DAYS * MS_PER_DAY,
      trialDays: DEFAULT_TRIAL_DAYS,
    });
    expect(res.trialDaysLeft).toBe(0);
    expect(res.expired).toBe(true);
  });

  it('nunca devuelve días negativos tras vencerse', () => {
    const res = computeTrialStatus({
      firstRunMs: firstRun(),
      nowMs: firstRun() + 60 * MS_PER_DAY,
      trialDays: DEFAULT_TRIAL_DAYS,
    });
    expect(res.trialDaysLeft).toBe(0);
    expect(res.expired).toBe(true);
  });
});