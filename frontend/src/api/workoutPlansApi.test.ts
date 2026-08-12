import { describe, it, expect, afterEach } from 'vitest';
import client from './client';
import { workoutPlansApi, toBuildPlanPayload } from './workoutPlansApi';
import type { WorkoutPlanDetail } from './workoutPlansApi';

describe('toBuildPlanPayload', () => {
  it('transforms a days-type plan, carrying over full exercise fidelity (notes, set_targets, duration, flags)', () => {
    const source: WorkoutPlanDetail = {
      plan: {
        id: 5,
        user_id: 1,
        name: 'Push Pull Legs',
        unit_type: 'days',
        total_units: 1,
        is_quick_start: false,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      days: [
        {
          id: 100,
          label: 'Day 1',
          order_position: 1,
          is_rest: false,
          exercises: [
            {
              id: 200,
              plan_day_id: 100,
              exercise_id: 1,
              order_number: 1,
              target_sets: 3,
              target_reps: '8',
              target_weight: 135,
              target_duration_seconds: null,
              has_reps: true,
              has_weight: true,
              has_duration: false,
              set_targets: [{ set_number: 1, target_reps: '6', target_weight: 145, target_duration_seconds: null }],
              notes: 'go slow',
              exercise_name: 'Bench Press',
              video_url: null,
            },
          ],
        },
      ],
      weeks: null,
    };

    const payload = toBuildPlanPayload(source, 'Push Pull Legs (Copy)');

    expect(payload).toEqual({
      name: 'Push Pull Legs (Copy)',
      unit_type: 'days',
      total_units: 1,
      days: [
        {
          label: 'Day 1',
          is_rest: false,
          order_position: 1,
          exercises: [
            {
              exercise_id: 1,
              target_sets: 3,
              target_reps: '8',
              target_weight: 135,
              target_duration_seconds: null,
              has_reps: true,
              has_weight: true,
              has_duration: false,
              notes: 'go slow',
              set_targets: [{ set_number: 1, target_reps: '6', target_weight: 145, target_duration_seconds: null }],
            },
          ],
        },
      ],
    });
  });

  it('defaults to the source plan name when no override is given', () => {
    const source: WorkoutPlanDetail = {
      plan: {
        id: 5,
        user_id: 1,
        name: 'Original Name',
        unit_type: 'days',
        total_units: 1,
        is_quick_start: false,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      days: [],
      weeks: null,
    };

    expect(toBuildPlanPayload(source).name).toBe('Original Name');
  });

  it('derives total_units from the day count when the source plan has a null total_units (e.g. a Quick Start plan)', () => {
    const source: WorkoutPlanDetail = {
      plan: {
        id: 33,
        user_id: 1,
        name: 'Quick Workout',
        unit_type: undefined,
        total_units: undefined,
        is_quick_start: true,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      days: [
        { id: 1, label: 'Day 1', order_position: 1, is_rest: false, exercises: [] },
        { id: 2, label: 'Day 2', order_position: 2, is_rest: false, exercises: [] },
        { id: 3, label: 'Day 3', order_position: 3, is_rest: false, exercises: [] },
      ],
      weeks: null,
    };

    const payload = toBuildPlanPayload(source);

    expect(payload.unit_type).toBe('days');
    expect(payload.total_units).toBe(3);
  });

  it('preserves a weeks-type plan\'s structure: base/custom weeks keep their days, linked weeks stay linked with no days of their own', () => {
    const source: WorkoutPlanDetail = {
      plan: {
        id: 6,
        user_id: 1,
        name: 'Periodized Plan',
        unit_type: 'weeks',
        total_units: 3,
        is_quick_start: false,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      days: null,
      weeks: [
        {
          week_number: 1,
          mode: 'base',
          resolved_week_number: 1,
          days: [
            { id: 100, label: 'Mon', order_position: 1, is_rest: false, exercises: [] },
          ],
        },
        {
          week_number: 2,
          mode: 'linked',
          resolved_week_number: 1,
          days: [], // linked weeks carry no days of their own on the source either
        },
        {
          week_number: 3,
          mode: 'custom',
          resolved_week_number: 3,
          days: [
            { id: 101, label: 'Mon (heavy)', order_position: 1, is_rest: false, exercises: [] },
          ],
        },
      ],
    };

    const payload = toBuildPlanPayload(source);

    expect(payload.weeks).toEqual([
      { week_number: 1, mode: 'base', days: [{ label: 'Mon', is_rest: false, order_position: 1, exercises: [] }] },
      { week_number: 2, mode: 'linked' }, // no `days` key at all
      { week_number: 3, mode: 'custom', days: [{ label: 'Mon (heavy)', is_rest: false, order_position: 1, exercises: [] }] },
    ]);
    expect(payload.weeks![1]).not.toHaveProperty('days');
  });
});

describe('workoutPlansApi.duplicate', () => {
  const originalAdapter = client.defaults.adapter;

  afterEach(() => {
    client.defaults.adapter = originalAdapter;
  });

  it('fetches the source plan then POSTs the transformed payload to /workout-plans/build', async () => {
    const sourceDetail: WorkoutPlanDetail = {
      plan: {
        id: 5,
        user_id: 1,
        name: 'Push Pull Legs',
        unit_type: 'days',
        total_units: 1,
        is_quick_start: false,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      days: [
        {
          id: 100,
          label: 'Day 1',
          order_position: 1,
          is_rest: false,
          exercises: [],
        },
      ],
      weeks: null,
    };

    const requests: { method: string; url: string; data?: any }[] = [];
    client.defaults.adapter = async (config: any) => {
      requests.push({ method: config.method, url: config.url, data: config.data ? JSON.parse(config.data) : undefined });
      if (config.method === 'get') {
        return { data: sourceDetail, status: 200, statusText: 'OK', headers: {}, config };
      }
      return {
        data: { ...sourceDetail, plan: { ...sourceDetail.plan, id: 6, name: 'Push Pull Legs (Copy)' } },
        status: 201,
        statusText: 'Created',
        headers: {},
        config,
      };
    };

    const result = await workoutPlansApi.duplicate(5, 'Push Pull Legs (Copy)');

    expect(requests[0]).toMatchObject({ method: 'get', url: '/workout-plans/5' });
    expect(requests[1]).toMatchObject({ method: 'post', url: '/workout-plans/build' });
    expect(requests[1].data.name).toBe('Push Pull Legs (Copy)');
    expect(requests[1].data.days).toHaveLength(1);
    expect(result.plan.id).toBe(6);
    expect(result.plan.name).toBe('Push Pull Legs (Copy)');
  });
});
