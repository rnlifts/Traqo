import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { DashboardHero } from './DashboardHero';
import { en } from '../i18n/en';

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));

vi.mock('../components/Toast', () => ({
  useToast: () => ({
    Toast: null,
    showToast: vi.fn(),
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
    finishWorkout: vi.fn(),
    discardSession: vi.fn(),
    quickStart: vi.fn(),
  },
}));

const unresolvedSession = {
  id: 123,
  user_id: 1,
  workout_plan_id: 1,
  plan_day_id: 1,
  plan_name: 'Full Body',
  day_label: 'Monday',
  started_at: new Date().toISOString(),
  completed_at: null,
};

const lastActivePlan = {
  workout_plan_id: 7,
  plan_name: 'Push Pull Legs',
  day_label: 'Push Day',
  session_id: 55,
  completed_at: new Date().toISOString(),
};

describe('DashboardHero', () => {
  let mockNavigate: any;
  let onUnresolvedSessionChange: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    onUnresolvedSessionChange = vi.fn();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof DashboardHero>> = {}) => {
    return render(
      <BrowserRouter>
        <DashboardHero
          unresolvedSession={null}
          lastActivePlan={null}
          onUnresolvedSessionChange={onUnresolvedSessionChange}
          {...props}
        />
      </BrowserRouter>
    );
  };

  describe('unresolved session (takes priority over everything)', () => {
    it('shows plan/day and Resume/Mark as Finished/Discard actions', () => {
      renderComponent({ unresolvedSession, lastActivePlan });

      expect(screen.getByText(/Full Body/)).toBeInTheDocument();
      expect(screen.getByText(/Monday/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark as Finished/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Discard/i })).toBeInTheDocument();
      // Should not show the "continue your plan" state underneath it
      expect(screen.queryByText('Push Pull Legs')).not.toBeInTheDocument();
    });

    it('Resume navigates to the active workout session', async () => {
      const user = userEvent.setup();
      renderComponent({ unresolvedSession });

      await user.click(screen.getByRole('button', { name: /Resume/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/workout-sessions/123');
    });

    it('Mark as Finished calls the API and clears the unresolved session', async () => {
      const user = userEvent.setup();
      const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
      (workoutSessionsApi.finishWorkout as any).mockResolvedValue({});

      renderComponent({ unresolvedSession });
      await user.click(screen.getByRole('button', { name: /Mark as Finished/i }));

      await waitFor(() => {
        expect(workoutSessionsApi.finishWorkout).toHaveBeenCalledWith(123);
        expect(onUnresolvedSessionChange).toHaveBeenCalledWith(null);
      });
    });

    it('Discard requires confirmation before calling the API', async () => {
      const user = userEvent.setup();
      const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
      (workoutSessionsApi.discardSession as any).mockResolvedValue({});

      renderComponent({ unresolvedSession });
      await user.click(screen.getByRole('button', { name: /Discard/i }));

      await waitFor(() => {
        expect(screen.getByText('Discard Workout')).toBeInTheDocument();
      });
      expect(workoutSessionsApi.discardSession).not.toHaveBeenCalled();

      const confirmButtons = screen.getAllByRole('button', { name: /^Discard$/ });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(workoutSessionsApi.discardSession).toHaveBeenCalledWith(123);
        expect(onUnresolvedSessionChange).toHaveBeenCalledWith(null);
      });
    });
  });

  describe('last active plan (no unresolved session)', () => {
    it('shows the most recently touched plan and day label', () => {
      renderComponent({ lastActivePlan });

      expect(screen.getByText(/Push Pull Legs/)).toBeInTheDocument();
      expect(screen.getByText(/Push Day/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Continue Now/i })).toBeInTheDocument();
    });

    it('Continue Now navigates to that plan\'s day picker', async () => {
      const user = userEvent.setup();
      renderComponent({ lastActivePlan });

      await user.click(screen.getByRole('button', { name: /Continue Now/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/workout-plans/7/start');
    });
  });

  describe('empty state (brand new user)', () => {
    it('shows the first-workout prompt with all three action buttons', () => {
      renderComponent();

      expect(screen.getByText(/Ready for Your First Workout/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Workout Plan/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Choose a Plan/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Empty Workout/i })).toBeInTheDocument();
    });

    it('Create Workout Plan navigates to the plan builder', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole('button', { name: /Create Workout Plan/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/workout-plans/new');
    });

    it('Choose a Plan navigates to the plans list', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole('button', { name: /Choose a Plan/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/workout-plans');
    });

    it('Start Empty Workout quick-starts and navigates to the new session', async () => {
      const user = userEvent.setup();
      const { workoutSessionsApi } = await import('../api/workoutSessionsApi');
      (workoutSessionsApi.quickStart as any).mockResolvedValue({ session_id: 999, message: 'ok' });

      renderComponent();
      await user.click(screen.getByRole('button', { name: /Start Empty Workout/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workout-sessions/999');
      });
    });
  });
});
