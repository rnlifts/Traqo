import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useParams, useNavigate } from 'react-router-dom';
import SessionSetupPage from './SessionSetupPage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

vi.mock('../api/workoutPlansApi', () => ({
  workoutPlansApi: {
    getDetail: vi.fn(),
    createDay: vi.fn(),
    deleteDay: vi.fn(),
  },
}));

vi.mock('../api/workoutSessionsApi', () => ({
  workoutSessionsApi: {
    startWorkout: vi.fn(),
  },
}));

vi.mock('../api/exercisesApi', () => ({
  exercisesApi: {
    list: vi.fn(),
  },
}));

vi.mock('../components/Toast', () => ({
  useToast: () => ({
    Toast: null,
    showToast: vi.fn(),
  }),
}));

const singleDayPlan = {
  plan: { id: 7, name: 'Upper Lower Split', unit_type: 'days', total_units: 1, is_quick_start: false },
  days: [
    {
      id: 55,
      label: 'Day 1',
      order_position: 1,
      is_rest: false,
      exercises: [{ id: 1, plan_day_id: 55, exercise_id: 1, order_number: 1, target_sets: 3, target_reps: '10', target_weight: null, target_duration_seconds: null, has_reps: true, has_weight: true, has_duration: false, set_targets: [] }],
    },
  ],
  weeks: null,
};

const quickStartPlan = {
  plan: { id: 8, name: 'Quick Start', unit_type: 'days', total_units: 1, is_quick_start: true },
  days: [
    { id: 60, label: 'Aug 1', order_position: 1, is_rest: false, exercises: [], created_at: '2026-08-01T00:00:00Z' },
  ],
  weeks: null,
};

const exercisesFixture = [{ id: 1, name: 'Bench Press', muscle_group: 'chest', logging_type: 'weight_reps', equipment: null, video_url: null, is_custom: false }];

describe('SessionSetupPage (Task 84 prefetch)', () => {
  let mockNavigate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    (useNavigate as any).mockReturnValue(mockNavigate);
    (useParams as any).mockReturnValue({ planId: '7' });
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <SessionSetupPage />
      </BrowserRouter>
    );

  it('fetches plan detail and exercises in parallel on load', async () => {
    const { workoutPlansApi } = await import('../api/workoutPlansApi');
    const { exercisesApi } = await import('../api/exercisesApi');
    (workoutPlansApi.getDetail as any).mockResolvedValue(singleDayPlan);
    (exercisesApi.list as any).mockResolvedValue(exercisesFixture);

    renderPage();

    await screen.findByText('Upper Lower Split');
    expect(workoutPlansApi.getDetail).toHaveBeenCalledWith(7);
    expect(exercisesApi.list).toHaveBeenCalledTimes(1);
  });

  it('"Begin workout" passes the already-loaded plan and exercises via navigation state', async () => {
    const user = userEvent.setup();
    const { workoutPlansApi } = await import('../api/workoutPlansApi');
    const { exercisesApi } = await import('../api/exercisesApi');
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutPlansApi.getDetail as any).mockResolvedValue(singleDayPlan);
    (exercisesApi.list as any).mockResolvedValue(exercisesFixture);
    (workoutSessionsApi.startWorkout as any).mockResolvedValue({ session_id: 321, message: 'Workout started' });

    renderPage();

    const beginButton = await screen.findByRole('button', { name: /Begin workout/i });
    await user.click(beginButton);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/workout-sessions/321', {
        state: { prefetchedPlanDetail: singleDayPlan, prefetchedExercises: exercisesFixture },
      })
    );
  });

  it('"Log new for today" (quick-start) navigates WITHOUT prefetched state', async () => {
    const user = userEvent.setup();
    const { workoutPlansApi } = await import('../api/workoutPlansApi');
    const { exercisesApi } = await import('../api/exercisesApi');
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutPlansApi.getDetail as any).mockResolvedValue(quickStartPlan);
    (exercisesApi.list as any).mockResolvedValue(exercisesFixture);
    (workoutPlansApi.createDay as any).mockResolvedValue({ id: 61, label: 'Day 2', order_position: 2, is_rest: false, exercises: [] });
    (workoutSessionsApi.startWorkout as any).mockResolvedValue({ session_id: 322, message: 'Workout started' });

    renderPage();

    const logNewButton = await screen.findByRole('button', { name: /Log new for today/i });
    await user.click(logNewButton);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/workout-sessions/322'));
    // The regression check: no second argument (no navigation state) — the newly-created
    // day isn't part of the already-fetched planDetail, so passing stale prefetched data
    // here would break day resolution on the workout screen.
    const call = mockNavigate.mock.calls.find((c: any[]) => c[0] === '/workout-sessions/322');
    expect(call.length).toBe(1);
  });
});
