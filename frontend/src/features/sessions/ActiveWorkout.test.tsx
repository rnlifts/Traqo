import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { ActiveWorkout } from './ActiveWorkout';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock('../../api/workoutSessionsApi', () => ({
  workoutSessionsApi: {
    addWorkoutSet: vi.fn(),
    deleteWorkoutSet: vi.fn(),
    finishWorkout: vi.fn(),
    discardSession: vi.fn(),
  },
}));

vi.mock('../../api/workoutPlansApi', () => ({
  updateWorkoutPlan: vi.fn(),
  addExerciseToDay: vi.fn(),
  updateExerciseInDay: vi.fn(),
}));

vi.mock('../../api/exercisesApi', () => ({
  exercisesApi: {
    create: vi.fn(),
  },
}));

vi.mock('../../components/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText }: any) => (
    isOpen ? (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm}>{confirmText}</button>
        <button onClick={onCancel}>{cancelText}</button>
      </div>
    ) : null
  ),
}));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    Toast: null,
    showToast: vi.fn(),
  }),
}));

vi.mock('../../contexts/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    setHasUnsavedChanges: vi.fn(),
  }),
}));

vi.mock('../../components/DurationInput', () => ({
  DurationInput: () => <input type="text" placeholder="Duration" />,
}));

describe('ActiveWorkout', () => {
  let mockNavigate: any;
  let mockOnFinish: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    mockOnFinish = vi.fn();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  const mockSession = {
    id: 1,
    user_id: 1,
    workout_plan_id: 1,
    plan_day_id: 1,
    plan_week_id: 1,
    started_at: new Date().toISOString(),
    completed_at: null,
    plan_name: 'Full Body',
    day_label: 'Monday',
    week_number: 1,
    duration_minutes: null,
  };

  const mockPlanExercises = [
    {
      id: 1,
      plan_day_id: 1,
      exercise_id: 1,
      order_number: 1,
      target_sets: 3,
      target_reps: '10',
      target_weight: 100,
      target_duration_seconds: null,
      has_reps: true,
      has_weight: true,
      has_duration: false,
      set_targets: [],
      notes: '',
      exercise_name: 'Bench Press',
    },
  ];

  const mockAvailableExercises = [
    { id: 1, name: 'Bench Press', logging_type: 'standard' },
  ];

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ActiveWorkout
          session={mockSession}
          planExercises={mockPlanExercises}
          availableExercises={mockAvailableExercises}
          onFinish={mockOnFinish}
          planName="Full Body"
          dayLabel="Monday"
        />
      </BrowserRouter>
    );
  };

  describe('Exit button', () => {
    it('shows Exit button', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /Exit/i })).toBeInTheDocument();
    });

    it('opens Exit options (Save & Exit / Discard) when Exit is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const exitButton = screen.getByRole('button', { name: /Exit/i });
      await user.click(exitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save & Exit/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Discard/i })).toBeInTheDocument();
      });
    });

    it('Save & Exit navigates back to plan without calling discard API', async () => {
      const user = userEvent.setup();
      renderComponent();

      const exitButton = screen.getByRole('button', { name: /Exit/i });
      await user.click(exitButton);

      const saveExitButton = await screen.findByRole('button', { name: /Save & Exit/i });
      await user.click(saveExitButton);

      const { workoutSessionsApi } = await import('../../api/workoutSessionsApi');
      expect(workoutSessionsApi.discardSession).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Discard confirmation', () => {
    it('Discard button shows confirmation dialog', async () => {
      const user = userEvent.setup();
      renderComponent();

      const exitButton = screen.getByRole('button', { name: /Exit/i });
      await user.click(exitButton);

      const discardButton = await screen.findByRole('button', { name: /Discard/i });
      await user.click(discardButton);

      // The exit banner should close, showing the confirmation dialog
      await waitFor(() => {
        const confirmDialog = screen.getByTestId('confirm-dialog');
        expect(confirmDialog).toBeInTheDocument();
      });
    });

    it('Confirms and calls discardSession API', async () => {
      const user = userEvent.setup();
      const { workoutSessionsApi } = await import('../../api/workoutSessionsApi');
      (workoutSessionsApi.discardSession as any).mockResolvedValue({});

      renderComponent();

      const exitButton = screen.getByRole('button', { name: /Exit/i });
      await user.click(exitButton);

      const discardButton = await screen.findByRole('button', { name: /Discard/i });
      await user.click(discardButton);

      // Find and click the confirm button in the dialog
      const confirmButtons = screen.getAllByRole('button', { name: /Discard/i });
      const confirmButton = confirmButtons[confirmButtons.length - 1]; // Last one is the confirm
      await user.click(confirmButton);

      await waitFor(() => {
        expect(workoutSessionsApi.discardSession).toHaveBeenCalledWith(1);
      });
    });
  });
});
