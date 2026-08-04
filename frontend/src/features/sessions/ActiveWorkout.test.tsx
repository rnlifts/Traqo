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

vi.mock('../../features/exerciseLibrary/ExerciseLibrarySidebar', () => ({
  ExerciseLibrarySidebar: ({ onSelectExercise, onPreviewExercise }: any) => (
    <div data-testid="exercise-library-sidebar">
      <button onClick={() => onSelectExercise({ name: 'Squat', video_url: null, muscle_group: 'Legs', equipment: null })}>
        Add Squat
      </button>
      <button onClick={() => onPreviewExercise({ name: 'Deadlift', video_url: null, muscle_group: 'Back', equipment: null })}>
        Preview Deadlift
      </button>
    </div>
  ),
}));

vi.mock('../../components/Modal', () => ({
  // Mirrors the real Modal's backdrop/content split: clicking inside content must not
  // bubble into onClose (the real component stops propagation on the content div).
  Modal: ({ isOpen, onClose, title, fullScreen, children }: any) => (
    isOpen ? (
      <div onClick={onClose}>
        <div data-testid="modal" data-fullscreen={fullScreen} onClick={(e: any) => e.stopPropagation()}>
          <h2>{title}</h2>
          {children}
        </div>
      </div>
    ) : null
  ),
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

  describe('Preview affordance and scroll-to-top', () => {
    it('shows a visible "Preview" indicator on each exercise row', () => {
      renderComponent();
      expect(screen.getByText(/👁️ Preview/)).toBeInTheDocument();
    });

    it('scrolls to top when previewing on desktop', async () => {
      const user = userEvent.setup();
      const scrollToSpy = vi.fn();
      window.scrollTo = scrollToSpy as any;
      mockViewport(false);

      renderComponent();

      const previewTrigger = await screen.findByRole('button', { name: /Preview Bench Press/i });
      await user.click(previewTrigger);

      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('does not call scrollTo when previewing on mobile (the modal is already in view)', async () => {
      const user = userEvent.setup();
      const scrollToSpy = vi.fn();
      window.scrollTo = scrollToSpy as any;
      mockViewport(true);

      renderComponent();

      const previewTrigger = await screen.findByRole('button', { name: /Preview Bench Press/i });
      await user.click(previewTrigger);

      expect(scrollToSpy).not.toHaveBeenCalled();
    });
  });

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

  function mockViewport(isMobile: boolean) {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: isMobile,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as any);
  }

  const renderQuickStart = (isMobile: boolean) => {
    mockViewport(isMobile);
    return render(
      <BrowserRouter>
        <ActiveWorkout
          session={mockSession}
          planExercises={mockPlanExercises}
          availableExercises={mockAvailableExercises}
          onFinish={mockOnFinish}
          planName="Full Body"
          dayLabel="Monday"
          planId={1}
          dayId={1}
          isQuickStart={true}
        />
      </BrowserRouter>
    );
  };

  describe('mobile exercise preview modal', () => {
    it('opens full-screen (not the small default dialog) on mobile', async () => {
      const user = userEvent.setup();
      mockViewport(true);
      renderComponent();

      const previewTrigger = await screen.findByRole('button', { name: /Preview Bench Press/i });
      await user.click(previewTrigger);

      // Regression check for the "modal is tiny on mobile" bug: the mobile preview modal
      // must be created with fullScreen={true}, not the default small centered dialog.
      const modal = await screen.findByTestId('modal');
      expect(modal).toHaveAttribute('data-fullscreen', 'true');
      expect(modal).toHaveTextContent('Bench Press');
    });
  });

  describe('Task 85: Exercise Library Sidebar — Desktop', () => {
    it('shows the always-visible sidebar when isQuickStart on desktop', async () => {
      renderQuickStart(false);
      expect(await screen.findByTestId('exercise-library-sidebar')).toBeInTheDocument();
    });

    it('does not show the sidebar when the plan is not quick-start', () => {
      mockViewport(false);
      render(
        <BrowserRouter>
          <ActiveWorkout
            session={mockSession}
            planExercises={mockPlanExercises}
            availableExercises={mockAvailableExercises}
            onFinish={mockOnFinish}
            planName="Full Body"
            dayLabel="Monday"
            planId={1}
            dayId={1}
            isQuickStart={false}
          />
        </BrowserRouter>
      );
      expect(screen.queryByTestId('exercise-library-sidebar')).not.toBeInTheDocument();
    });
  });

  describe('Task 85: Exercise Library Sidebar — Mobile', () => {
    it('sidebar is hidden by default and opens in a full-screen modal via "+ Add Exercise"', async () => {
      const user = userEvent.setup();
      renderQuickStart(true);

      expect(screen.queryByTestId('exercise-library-sidebar')).not.toBeInTheDocument();

      const addButton = await screen.findByRole('button', { name: /\+ Add Exercise/i });
      await user.click(addButton);

      const modal = await screen.findByTestId('modal');
      expect(modal).toHaveAttribute('data-fullscreen', 'true');
      expect(screen.getByTestId('exercise-library-sidebar')).toBeInTheDocument();
    });
  });

  describe('Task 85: Quick Add with Explicit Set Count', () => {
    it('quick-adding a library exercise calls addExerciseToDay with targetSets: 1', async () => {
      const user = userEvent.setup();
      const { addExerciseToDay } = await import('../../api/workoutPlansApi');
      const { exercisesApi } = await import('../../api/exercisesApi');
      (addExerciseToDay as any).mockResolvedValue({});
      (exercisesApi.create as any).mockResolvedValue({ id: 99, name: 'Squat' });

      renderQuickStart(false);

      const addSquatButton = await screen.findByRole('button', { name: 'Add Squat' });
      await user.click(addSquatButton);

      await waitFor(() =>
        expect(addExerciseToDay).toHaveBeenCalledWith(1, 1, 99, 1, undefined, undefined, undefined, true, true, false)
      );
    });
  });

  describe('Task 85: Double-Tap Guard', () => {
    it('rapid double-selection of the same exercise only creates it once', async () => {
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { addExerciseToDay } = await import('../../api/workoutPlansApi');
      (addExerciseToDay as any).mockResolvedValue({});
      // Never resolves within the test, simulating an in-flight request when the second
      // click arrives — this is the exact window the guard exists to protect.
      (exercisesApi.create as any).mockReturnValue(new Promise(() => {}));

      renderQuickStart(false);

      const addSquatButton = await screen.findByRole('button', { name: 'Add Squat' });
      // Two rapid clicks, not awaited between — simulates a double-tap.
      addSquatButton.click();
      addSquatButton.click();

      await waitFor(() => expect(exercisesApi.create).toHaveBeenCalledTimes(1));
    });
  });

  describe('Task 85: Unified Preview State', () => {
    it('previewing an existing workout exercise and a library exercise both update the same preview panel', async () => {
      const user = userEvent.setup();
      renderQuickStart(false);

      const previewTrigger = await screen.findByRole('button', { name: /Preview Bench Press/i });
      await user.click(previewTrigger);
      expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();

      const previewDeadliftButton = await screen.findByRole('button', { name: 'Preview Deadlift' });
      await user.click(previewDeadliftButton);

      // Same panel now shows Deadlift instead — proves one shared selectedPreview state,
      // not two independent preview mechanisms running side by side.
      expect(screen.getByText('Deadlift')).toBeInTheDocument();
    });

    it('mobile: the preview modal renders after (on top of) the exercise-picker modal in the DOM', async () => {
      // Regression test for a confirmed live bug: both modals use the same fixed
      // position/z-index, so whichever renders LATER in the DOM paints on top. Previewing
      // a library exercise from within the "Add Exercise" picker must produce a preview
      // modal that comes after the picker modal in document order — otherwise the picker
      // visually covers the preview and tapping "preview" appears to do nothing.
      const user = userEvent.setup();
      renderQuickStart(true);

      const addButton = await screen.findByRole('button', { name: /\+ Add Exercise/i });
      await user.click(addButton);

      const previewDeadliftButton = await screen.findByRole('button', { name: 'Preview Deadlift' });
      await user.click(previewDeadliftButton);

      const modals = await screen.findAllByTestId('modal');
      expect(modals).toHaveLength(2);
      const [first, second] = modals;
      expect(first).toHaveTextContent('Add Exercise');
      expect(second).toHaveTextContent('Deadlift');
      // DOCUMENT_POSITION_FOLLOWING (4) confirms `second` genuinely comes after `first`.
      expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('Task 85: Set Count Regression', () => {
    it('defaults to 1 set when target_sets is null (not 3)', async () => {
      const exerciseWithNullSets = [
        {
          ...mockPlanExercises[0],
          target_sets: null,
        },
      ];

      render(
        <BrowserRouter>
          <ActiveWorkout
            session={mockSession}
            planExercises={exerciseWithNullSets}
            availableExercises={mockAvailableExercises}
            onFinish={mockOnFinish}
            planName="Full Body"
            dayLabel="Monday"
          />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Set \d+, not logged/i })).toHaveLength(1);
      });
    });
  });
});
