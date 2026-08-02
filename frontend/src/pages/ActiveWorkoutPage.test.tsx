import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, useParams } from 'react-router-dom';
import ActiveWorkoutPage from './ActiveWorkoutPage';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../features/sessions/ActiveWorkout', () => ({
  ActiveWorkout: ({ previousPerformance }: any) => (
    <div data-testid="active-workout">
      Active Workout
      <div data-testid="previous-performance">
        {previousPerformance ? 'has previous performance' : 'no previous performance yet'}
      </div>
    </div>
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../api/workoutSessionsApi', () => ({
  workoutSessionsApi: {
    getActiveWorkoutBootstrap: vi.fn(),
  },
}));

vi.mock('../api/workoutPlansApi', () => ({
  getWorkoutPlanDetail: vi.fn(),
  getPreviousPerformance: vi.fn(),
}));

const planDetail = {
  plan: { id: 10, name: 'Test Plan', unit_type: 'days', total_units: 1, is_quick_start: false },
  days: [
    {
      id: 20,
      label: 'Day 1',
      order_position: 1,
      is_rest: false,
      exercises: [],
    },
  ],
  weeks: null,
};

const bootstrapFixture = {
  session: {
    session: {
      id: 5,
      user_id: 1,
      workout_plan_id: 10,
      plan_name: 'Test Plan',
      plan_day_id: 20,
      day_label: 'Day 1',
      plan_week_id: null,
      week_number: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      duration_minutes: null,
    },
    sets: [],
  },
  plan: planDetail,
  exercises: [],
};

describe('ActiveWorkoutPage (Task 83 bootstrap)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (useParams as any).mockReturnValue({ sessionId: '5' });
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <ActiveWorkoutPage />
      </BrowserRouter>
    );

  it('renders session/plan/exercise data from a single bootstrap call', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getActiveWorkoutBootstrap as any).mockResolvedValue(bootstrapFixture);
    const { getPreviousPerformance } = await import('../api/workoutPlansApi');
    (getPreviousPerformance as any).mockResolvedValue(null);

    renderPage();

    await screen.findByTestId('active-workout');
    expect(workoutSessionsApi.getActiveWorkoutBootstrap).toHaveBeenCalledTimes(1);
    expect(workoutSessionsApi.getActiveWorkoutBootstrap).toHaveBeenCalledWith(5);
  });

  it('renders the page without waiting for previous-performance to resolve', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getActiveWorkoutBootstrap as any).mockResolvedValue(bootstrapFixture);
    const { getPreviousPerformance } = await import('../api/workoutPlansApi');
    // Never resolves — if the page waited on this, the test would time out.
    (getPreviousPerformance as any).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(await screen.findByTestId('active-workout')).toBeInTheDocument();
    expect(screen.getByTestId('previous-performance')).toHaveTextContent('no previous performance yet');
  });

  it('updates with previous-performance data once it resolves, without re-fetching bootstrap', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getActiveWorkoutBootstrap as any).mockResolvedValue(bootstrapFixture);
    const { getPreviousPerformance } = await import('../api/workoutPlansApi');
    (getPreviousPerformance as any).mockResolvedValue({ session_date: '2026-08-01', exercises: [] });

    renderPage();

    await screen.findByTestId('active-workout');
    await waitFor(() =>
      expect(screen.getByTestId('previous-performance')).toHaveTextContent('has previous performance')
    );

    expect(workoutSessionsApi.getActiveWorkoutBootstrap).toHaveBeenCalledTimes(1);
  });

  it('does not show an error or block the page when previous-performance fails', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getActiveWorkoutBootstrap as any).mockResolvedValue(bootstrapFixture);
    const { getPreviousPerformance } = await import('../api/workoutPlansApi');
    (getPreviousPerformance as any).mockRejectedValue(new Error('network error'));

    renderPage();

    await screen.findByTestId('active-workout');
    // Page stays on the workout UI, not the error screen
    expect(screen.queryByText(/Back to Plans/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('previous-performance')).toHaveTextContent('no previous performance yet');
  });
});
