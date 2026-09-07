import { describe, it, expect } from 'vitest';
import { resolveSessionDay } from './sessionDayResolver';
import type { WorkoutPlanDetail } from '../../api/workoutPlansApi';

function daysTypePlan(customName: string | null = null): WorkoutPlanDetail {
  return {
    plan: { id: 1, user_id: 1, name: 'Test Plan', unit_type: 'days', total_units: 1, is_quick_start: false },
    days: [
      {
        id: 10,
        label: 'Day 1',
        order_position: 1,
        is_rest: false,
        custom_name: customName,
        exercises: [],
      },
    ],
    weeks: null,
  } as any;
}

function weeksTypePlan(customName: string | null = null): WorkoutPlanDetail {
  return {
    plan: { id: 2, user_id: 1, name: 'Weekly Plan', unit_type: 'weeks', total_units: 1, is_quick_start: false },
    days: null,
    weeks: [
      {
        week_number: 1,
        mode: 'base',
        days: [
          {
            id: 20,
            label: 'Day 1',
            order_position: 1,
            is_rest: false,
            custom_name: customName,
            exercises: [],
          },
        ],
      },
    ],
  } as any;
}

describe('resolveSessionDay', () => {
  it('returns the plain label when no custom_name is set (days-type)', () => {
    const { dayLabel } = resolveSessionDay(daysTypePlan(), 10);
    expect(dayLabel).toBe('Day 1');
  });

  it('appends the custom_name to the label rather than replacing it (days-type)', () => {
    const { dayLabel } = resolveSessionDay(daysTypePlan('Chest Day'), 10);
    expect(dayLabel).toBe('Day 1 — Chest Day');
  });

  it('appends the custom_name after the week prefix (weeks-type)', () => {
    const { dayLabel } = resolveSessionDay(weeksTypePlan('Chest Day'), 20);
    expect(dayLabel).toBe('Week 1 · Day 1 — Chest Day');
  });

  it('returns the plain week label when no custom_name is set (weeks-type)', () => {
    const { dayLabel } = resolveSessionDay(weeksTypePlan(), 20);
    expect(dayLabel).toBe('Week 1 · Day 1');
  });

  it('still resolves the matching day object correctly alongside the label', () => {
    const { matchingDay } = resolveSessionDay(daysTypePlan('Chest Day'), 10);
    expect(matchingDay?.id).toBe(10);
    expect(matchingDay?.custom_name).toBe('Chest Day');
  });
});
