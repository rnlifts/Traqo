import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { LanguageProvider } from '../contexts/LanguageContext';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../components/DashboardHero', () => ({
  DashboardHero: ({ unresolvedSession, lastActivePlan }: any) => (
    <div data-testid="dashboard-hero">
      {unresolvedSession ? `unresolved:${unresolvedSession.plan_name}` : ''}
      {lastActivePlan ? `last-active:${lastActivePlan.plan_name}` : ''}
      {!unresolvedSession && !lastActivePlan ? 'empty-state' : ''}
    </div>
  ),
}));

vi.mock('../components/WeeklyStatsTiles', () => ({
  WeeklyStatsTiles: ({ stats }: any) => (
    <div data-testid="weekly-stats-tiles">{JSON.stringify(stats)}</div>
  ),
}));

vi.mock('../components/WeeklyActivityCalendar', () => ({
  WeeklyActivityCalendar: ({ days }: any) => (
    <div data-testid="weekly-activity-calendar">{days.length} days</div>
  ),
}));

vi.mock('../components/DashboardProgressPreview', () => ({
  DashboardProgressPreview: ({ randomExercise }: any) => (
    <div data-testid="dashboard-progress-preview">
      {randomExercise ? randomExercise.exercise_name : 'no-exercise'}
    </div>
  ),
}));

vi.mock('../components/ProfileCard', () => ({
  ProfileCard: ({ profile }: any) => <div data-testid="profile-card">{profile.display_name}</div>,
}));

vi.mock('../components/BodyStatsCard', () => ({
  BodyStatsCard: ({ bodyMetrics }: any) => (
    <div data-testid="body-stats-card">{bodyMetrics.bmi}</div>
  ),
}));

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { display_name: 'Test User' },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock('../api/workoutSessionsApi', () => ({
  workoutSessionsApi: {
    getWorkoutHistory: vi.fn(),
    getUnresolvedSession: vi.fn(),
    getLastActivePlan: vi.fn(),
  },
}));

vi.mock('../api/dashboardApi', () => ({
  dashboardApi: {
    getSummary: vi.fn(),
  },
}));

vi.mock('../api/authApi', () => ({
  authApi: {
    getMe: vi.fn(),
  },
}));

describe('Dashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(vi.fn());
    const { dashboardApi } = await import('../api/dashboardApi');
    (dashboardApi.getSummary as any).mockResolvedValue({
      weekly_stats: { workout_count: 0, total_volume: 0, pr_count: 0 },
      weekly_activity: [],
      random_exercise: null,
    });
    const { authApi } = await import('../api/authApi');
    (authApi.getMe as any).mockResolvedValue({
      username: 'testuser',
      display_name: 'Test User',
      age: null,
      weight_kg: null,
      height_cm: null,
      gender: null,
      activity_level: null,
      is_complete: false,
      body_metrics: null,
    });
  });

  const renderComponent = () => {
    return render(
      <LanguageProvider>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </LanguageProvider>
    );
  };

  it('fetches history, unresolved session, and last active plan in parallel, then renders the hero', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
    (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue(null);
    (workoutSessionsApi.getLastActivePlan as any).mockResolvedValue(null);

    renderComponent();

    await waitFor(() => {
      expect(workoutSessionsApi.getWorkoutHistory).toHaveBeenCalledTimes(1);
      expect(workoutSessionsApi.getUnresolvedSession).toHaveBeenCalledTimes(1);
      expect(workoutSessionsApi.getLastActivePlan).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('dashboard-hero')).toHaveTextContent('empty-state');
    });

    // The "Plan Everything Upfront" / "Start Small" cards were removed in favor of
    // the equivalent actions living inside the hero card's empty state.
    expect(screen.queryByText('Plan Everything Upfront')).not.toBeInTheDocument();
    expect(screen.queryByText(/Start Small/)).not.toBeInTheDocument();
  });

  it('passes the unresolved session through to the hero', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
    (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue({
      id: 1,
      plan_name: 'Full Body',
      day_label: 'Monday',
      started_at: new Date().toISOString(),
    });
    (workoutSessionsApi.getLastActivePlan as any).mockResolvedValue(null);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-hero')).toHaveTextContent('unresolved:Full Body');
    });
  });

  it('passes the last active plan through to the hero when there is no unresolved session', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
    (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue(null);
    (workoutSessionsApi.getLastActivePlan as any).mockResolvedValue({
      workout_plan_id: 7,
      plan_name: 'Push Pull Legs',
      day_label: 'Push Day',
      session_id: 55,
      completed_at: new Date().toISOString(),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-hero')).toHaveTextContent('last-active:Push Pull Legs');
    });
  });

  it('shows recent workouts once loaded', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([
      { session_id: 1, date: new Date().toISOString(), workout: 'Full Body', duration: '45 minutes' },
    ]);
    (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue(null);
    (workoutSessionsApi.getLastActivePlan as any).mockResolvedValue(null);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Full Body')).toBeInTheDocument();
    });
  });

  it('fetches the dashboard summary independently and passes it to the weekly widgets', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    const { dashboardApi } = await import('../api/dashboardApi');
    (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
    (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue(null);
    (workoutSessionsApi.getLastActivePlan as any).mockResolvedValue(null);
    (dashboardApi.getSummary as any).mockResolvedValue({
      weekly_stats: { workout_count: 3, total_volume: 500, pr_count: 1 },
      weekly_activity: [{ day_label: 'Sun', date: '2026-08-09', has_workout: false, session_id: null }],
      random_exercise: { exercise_id: 9, exercise_name: 'Squat' },
    });

    renderComponent();

    await waitFor(() => {
      expect(dashboardApi.getSummary).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('weekly-stats-tiles')).toHaveTextContent('"workout_count":3');
      expect(screen.getByTestId('weekly-activity-calendar')).toHaveTextContent('1 days');
      expect(screen.getByTestId('dashboard-progress-preview')).toHaveTextContent('Squat');
    });
  });

  it('still renders the hero and recent workouts if the summary fetch fails', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    const { dashboardApi } = await import('../api/dashboardApi');
    (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([
      { session_id: 1, date: new Date().toISOString(), workout: 'Full Body', duration: '45 minutes' },
    ]);
    (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue(null);
    (workoutSessionsApi.getLastActivePlan as any).mockResolvedValue(null);
    (dashboardApi.getSummary as any).mockRejectedValue(new Error('network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-hero')).toHaveTextContent('empty-state');
      expect(screen.getByText('Full Body')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('weekly-stats-tiles')).not.toBeInTheDocument();
  });

  it('fetches the profile independently and renders the sidebar profile/body-stats widgets', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    const { authApi } = await import('../api/authApi');
    (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
    (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue(null);
    (workoutSessionsApi.getLastActivePlan as any).mockResolvedValue(null);
    (authApi.getMe as any).mockResolvedValue({
      username: 'aryanlifts',
      display_name: 'Aryan',
      age: 25,
      weight_kg: 70,
      height_cm: 175,
      gender: 'male',
      activity_level: 'moderate',
      is_complete: true,
      body_metrics: { bmi: 22.9, bmr: 1673.8, maintenance_calories: 2594 },
    });

    renderComponent();

    await waitFor(() => {
      expect(authApi.getMe).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('profile-card')).toHaveTextContent('Aryan');
      expect(screen.getByTestId('body-stats-card')).toHaveTextContent('22.9');
    });
  });

  it('does not render the profile widgets if the profile fetch fails, without breaking the rest of the page', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    const { authApi } = await import('../api/authApi');
    (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
    (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue(null);
    (workoutSessionsApi.getLastActivePlan as any).mockResolvedValue(null);
    (authApi.getMe as any).mockRejectedValue(new Error('network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-hero')).toHaveTextContent('empty-state');
    });
    expect(screen.queryByTestId('profile-card')).not.toBeInTheDocument();
  });

  it('puts the main content and recent workouts sidebar in the two-column dashboard layout', async () => {
    const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
    (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
    (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue(null);
    (workoutSessionsApi.getLastActivePlan as any).mockResolvedValue(null);

    const { container } = renderComponent();

    await waitFor(() => {
      const main = container.querySelector('.dashboard-main');
      const sidebar = container.querySelector('.dashboard-sidebar');
      expect(main).toContainElement(screen.getByTestId('dashboard-hero'));
      expect(sidebar).toHaveTextContent('Recent workouts');
    });
  });
});
