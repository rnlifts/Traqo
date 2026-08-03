import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, useParams, useLocation } from 'react-router-dom';
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
    useLocation: vi.fn(),
  };
});

vi.mock('../api/workoutSessionsApi', () => ({
  workoutSessionsApi: {
    getActiveWorkoutBootstrap: vi.fn(),
    getSessionDetail: vi.fn(),
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
    (useLocation as any).mockReturnValue({ state: null });
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

describe('ActiveWorkoutPage (Task 84 prefetch from Session Setup)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (useParams as any).mockReturnValue({ sessionId: '5' });
    const { getPreviousPerformance } = await import('../api/workoutPlansApi');
    (getPreviousPerformance as any).mockResolvedValue(null);
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <ActiveWorkoutPage />
      </BrowserRouter>
    );

  const sessionDetailFixture = {
    session: bootstrapFixture.session.session,
    sets: [],
  };

  it('uses prefetched plan/exercises and only fetches session detail when navigation state is present', async () => {
    (useLocation as any).mockReturnValue({
      state: { prefetchedPlanDetail: planDetail, prefetchedExercises: [{ id: 1, name: 'Bench', logging_type: 'weight_reps' }] },
    });
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getSessionDetail as any).mockResolvedValue(sessionDetailFixture);

    renderPage();

    await screen.findByTestId('active-workout');
    expect(workoutSessionsApi.getSessionDetail).toHaveBeenCalledWith(5);
    // The core regression check: prefetched path never calls the bootstrap endpoint
    expect(workoutSessionsApi.getActiveWorkoutBootstrap).not.toHaveBeenCalled();
  });

  it('falls back to the bootstrap endpoint when navigation state is absent (refresh/direct URL/resume)', async () => {
    (useLocation as any).mockReturnValue({ state: null });
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getActiveWorkoutBootstrap as any).mockResolvedValue(bootstrapFixture);

    renderPage();

    await screen.findByTestId('active-workout');
    expect(workoutSessionsApi.getActiveWorkoutBootstrap).toHaveBeenCalledWith(5);
    expect(workoutSessionsApi.getSessionDetail).not.toHaveBeenCalled();
  });

  it('falls back to bootstrap when navigation state is only partially present', async () => {
    // Only prefetchedPlanDetail, no prefetchedExercises — e.g. a future caller that forgot
    // one of the two. Must not silently render with an empty/undefined exercises list.
    (useLocation as any).mockReturnValue({ state: { prefetchedPlanDetail: planDetail } });
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getActiveWorkoutBootstrap as any).mockResolvedValue(bootstrapFixture);

    renderPage();

    await screen.findByTestId('active-workout');
    expect(workoutSessionsApi.getActiveWorkoutBootstrap).toHaveBeenCalledWith(5);
    expect(workoutSessionsApi.getSessionDetail).not.toHaveBeenCalled();
  });
});
