import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../components/PlanActionCards', () => ({
  PlanActionCards: () => <div data-testid="plan-action-cards">Plan Action Cards</div>,
}));

vi.mock('../components/Toast', () => ({
  useToast: () => ({
    Toast: null,
    showToast: vi.fn(),
  }),
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
    finishWorkout: vi.fn(),
    discardSession: vi.fn(),
  },
}));

describe('Dashboard', () => {
  let mockNavigate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  describe('unresolved session banner', () => {
    it('shows banner when there is an unresolved session', async () => {
      const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
      (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
      (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue({
        id: 1,
        plan_name: 'Full Body',
        day_label: 'Monday',
        started_at: new Date().toISOString(),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('You have an unfinished workout')).toBeInTheDocument();
        expect(screen.getByText('Full Body')).toBeInTheDocument();
      });
    });

    it('hides banner when there is no unresolved session', async () => {
      const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
      (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
      (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue(null);

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('You have an unfinished workout')).not.toBeInTheDocument();
      });
    });
  });

  describe('unresolved session actions', () => {
    it('Resume button navigates to workout session', async () => {
      const user = userEvent.setup();
      const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
      (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
      (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue({
        id: 123,
        plan_name: 'Full Body',
        day_label: 'Monday',
        started_at: new Date().toISOString(),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('You have an unfinished workout')).toBeInTheDocument();
      });

      const resumeButton = screen.getByRole('button', { name: /Resume/i });
      await user.click(resumeButton);

      expect(mockNavigate).toHaveBeenCalledWith('/workout-sessions/123');
    });

    it('Mark as Finished calls the API and removes banner', async () => {
      const user = userEvent.setup();
      const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
      (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
      (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue({
        id: 123,
        plan_name: 'Full Body',
        day_label: 'Monday',
        started_at: new Date().toISOString(),
      });
      (workoutSessionsApi.finishWorkout as any).mockResolvedValue({});

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('You have an unfinished workout')).toBeInTheDocument();
      });

      const finishButton = screen.getByRole('button', { name: /Mark as Finished/i });
      await user.click(finishButton);

      await waitFor(() => {
        expect(workoutSessionsApi.finishWorkout).toHaveBeenCalledWith(123);
        expect(screen.queryByText('You have an unfinished workout')).not.toBeInTheDocument();
      });
    });

    it('Discard button requires confirmation', async () => {
      const user = userEvent.setup();
      const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
      (workoutSessionsApi.getWorkoutHistory as any).mockResolvedValue([]);
      (workoutSessionsApi.getUnresolvedSession as any).mockResolvedValue({
        id: 123,
        plan_name: 'Full Body',
        day_label: 'Monday',
        started_at: new Date().toISOString(),
      });
      (workoutSessionsApi.discardSession as any).mockResolvedValue({});

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('You have an unfinished workout')).toBeInTheDocument();
      });

      const discardButton = screen.getByRole('button', { name: /Discard/i });
      await user.click(discardButton);

      // Confirm dialog should appear with title "Discard Workout"
      await waitFor(() => {
        expect(screen.getByText('Discard Workout')).toBeInTheDocument();
      });

      // Find and click the confirm button in the dialog
      const confirmButtons = screen.getAllByRole('button', { name: /^Discard$/ });
      const confirmDiscardButton = confirmButtons[confirmButtons.length - 1]; // Last one is the confirm
      await user.click(confirmDiscardButton);

      await waitFor(() => {
        expect(workoutSessionsApi.discardSession).toHaveBeenCalledWith(123);
        expect(screen.queryByText('You have an unfinished workout')).not.toBeInTheDocument();
      });
    });
  });
});
