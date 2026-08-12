import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { PlanBuilder } from './PlanBuilder';
import { en } from '../../i18n/en';

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));
import * as exercisesApiModule from '../../api/exercisesApi';
import { customizeWeek, updateExerciseInDay, updateDay, removeExerciseFromDay, addExerciseToDay, replaceSetTargets } from '../../api/workoutPlansApi';
import client from '../../api/client';
import type { WorkoutPlanDetail } from '../../api/workoutPlansApi';
import { getClipboard, setClipboard, clearClipboard } from '../../utils/exerciseClipboard';

// Mock dependencies
vi.mock('../../api/workoutPlansApi', () => ({
  buildPlan: vi.fn(),
  updateDay: vi.fn(),
  addExerciseToDay: vi.fn(),
  updateExerciseInDay: vi.fn(),
  removeExerciseFromDay: vi.fn(),
  customizeWeek: vi.fn(),
  matchPreviousWeek: vi.fn(),
  updateWorkoutPlan: vi.fn(),
  replaceSetTargets: vi.fn(),
  workoutPlansApi: {
    getWorkoutPlan: vi.fn(),
  },
}));

vi.mock('../../api/exercisesApi', () => ({
  exercisesApi: {
    list: vi.fn(),
    listCustomOnly: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
    Toast: <div />,
  })),
}));

vi.mock('../exerciseLibrary/ExerciseLibrarySidebar', () => ({
  ExerciseLibrarySidebar: ({ onSelectExercise, onPreviewExercise }: any) => (
    <div data-testid="sidebar">
      <button
        data-testid="library-exercise-add"
        onClick={() => onSelectExercise({ name: 'Bench Press', video_url: 'https://youtube.com/watch?v=test1' })}
      >
        Add Library Exercise
      </button>
      <button
        data-testid="library-exercise-preview"
        onClick={() => onPreviewExercise?.({ name: 'Bench Press', video_url: 'https://youtube.com/watch?v=test1' })}
      >
        Preview Library Exercise
      </button>
      <button
        data-testid="custom-exercise-preview"
        onClick={() => onPreviewExercise?.({ name: 'Custom Exercise', video_url: 'https://youtube.com/watch?v=test2' })}
      >
        Preview Custom Exercise
      </button>
    </div>
  ),
  SelectedExerciseInfo: {},
}));

vi.mock('../../components/ExercisePreviewPanel', () => ({
  ExercisePreviewPanel: ({ selected }: any) => (
    <div data-testid="preview-panel">
      {selected
        ? `Preview: ${selected.name} (${selected.video_url ? 'has video' : 'no video'})`
        : 'No exercise selected'}
    </div>
  ),
}));

vi.mock('../../utils/youtube', () => ({
  getYoutubeThumbnailUrl: vi.fn((url?: string | null) => {
    if (!url) return null;
    return 'https://img.youtube.com/vi/test/hqdefault.jpg';
  }),
}));

describe('PlanBuilder Task 81: True Optimistic Updates', () => {
  const oneExerciseFixture: WorkoutPlanDetail = {
    plan: {
      id: 5,
      user_id: 1,
      name: 'Optimistic Plan',
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
            target_sets: 1,
            target_reps: '10',
            target_weight: null,
            target_duration_seconds: null,
            has_reps: true,
            has_weight: true,
            has_duration: false,
            set_targets: [],
            notes: '',
            exercise_name: 'Bench Press',
            video_url: null,
          },
        ],
      },
    ],
    weeks: null,
  };

  const twoExerciseFixture: WorkoutPlanDetail = {
    ...oneExerciseFixture,
    days: [
      {
        ...oneExerciseFixture.days![0],
        exercises: [
          oneExerciseFixture.days![0].exercises[0],
          {
            id: 201,
            plan_day_id: 100,
            exercise_id: 2,
            order_number: 2,
            target_sets: 1,
            target_reps: '10',
            target_weight: null,
            target_duration_seconds: null,
            has_reps: true,
            has_weight: true,
            has_duration: false,
            set_targets: [],
            notes: '',
            exercise_name: 'Squat',
            video_url: null,
          },
        ],
      },
    ],
  };

  const emptyDayFixture: WorkoutPlanDetail = {
    ...oneExerciseFixture,
    days: [{ ...oneExerciseFixture.days![0], exercises: [] }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const mocked = vi.mocked(exercisesApiModule.exercisesApi);
    mocked.list.mockResolvedValue([]);
  });

  it('adding a set updates the UI immediately, before the API call resolves', async () => {
    const user = userEvent.setup();
    vi.mocked(client.get).mockResolvedValue({ data: oneExerciseFixture } as any);
    // Never-resolving promises: if the set only appeared after these resolved, this test would hang/time out.
    vi.mocked(replaceSetTargets).mockReturnValue(new Promise(() => {}) as any);
    vi.mocked(updateExerciseInDay).mockReturnValue(new Promise(() => {}) as any);

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Bench Press');
    await user.click(screen.getByRole('button', { name: 'Expand Bench Press' }));
    await user.click(screen.getByRole('button', { name: '+ Add Set' }));

    // Set 2's remove button appearing proves the second set was added locally without
    // waiting for the (never-resolving) API calls.
    expect(await screen.findByRole('button', { name: 'Remove Set 2' })).toBeInTheDocument();
  });

  it('toggling rest day reverts to the original state if the API call fails', async () => {
    const user = userEvent.setup();
    vi.mocked(client.get).mockResolvedValue({ data: oneExerciseFixture } as any);
    vi.mocked(updateDay).mockRejectedValue(new Error('network error'));

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Bench Press');
    const toggleButton = screen.getByRole('button', { name: 'No' });
    await user.click(toggleButton);

    // The mock rejects synchronously, so by the time userEvent's click settles the
    // optimistic-then-reverted cycle has already completed within the same flush — the
    // meaningful assertion is the end state (reverted) plus proof the optimistic value
    // (true) was actually the one sent to the API, not just the final reverted one.
    await waitFor(() => expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument());
    expect(vi.mocked(updateDay)).toHaveBeenCalledWith(5, 100, { is_rest: true });
  });

  it('removing an exercise re-inserts it at its original position if the API call fails', async () => {
    const user = userEvent.setup();
    vi.mocked(client.get).mockResolvedValue({ data: twoExerciseFixture } as any);
    vi.mocked(removeExerciseFromDay).mockRejectedValue(new Error('network error'));

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Bench Press');
    await screen.findByText('Squat');

    const removeButtons = screen.getAllByRole('button', { name: 'Remove exercise' });
    await user.click(removeButtons[0]); // Bench Press is first
    await user.click(screen.getByRole('button', { name: 'Delete' })); // confirm dialog

    // The mock rejects synchronously, so the optimistic-removal-then-revert cycle
    // completes within the same flush as the click above — assert the end state:
    // Bench Press is back, in its original (first) position, once the API call failed.
    await waitFor(() => expect(vi.mocked(removeExerciseFromDay)).toHaveBeenCalledWith(5, 100, 200));
    await screen.findByText('Bench Press');
    const namesAfterRevert = screen.getAllByText(/^(Bench Press|Squat)$/).map((el) => el.textContent);
    expect(namesAfterRevert).toEqual(['Bench Press', 'Squat']);
  });

  it('adding an exercise reconciles the temporary ID once the real ID comes back', async () => {
    const user = userEvent.setup();
    vi.mocked(client.get).mockResolvedValue({ data: emptyDayFixture } as any);
    const mockedExercisesApi = vi.mocked(exercisesApiModule.exercisesApi);
    mockedExercisesApi.create.mockResolvedValue({
      id: 1,
      name: 'Bench Press',
      video_url: 'https://youtube.com/watch?v=test1',
      muscle_group: 'chest',
      equipment: 'barbell',
      is_custom: false,
      logging_type: 'weights',
    });

    let resolveAdd: (value: any) => void = () => {};
    const addPromise = new Promise((resolve) => {
      resolveAdd = resolve;
    });
    vi.mocked(addExerciseToDay).mockReturnValue(addPromise as any);
    vi.mocked(updateExerciseInDay).mockResolvedValue({} as any);

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Exercises');
    await user.click(screen.getByTestId('library-exercise-add'));

    // Appears immediately, before addExerciseToDay resolves — the exercise's real ID isn't
    // known yet, so it's holding a temporary (negative) ID under the hood.
    await screen.findByText('Bench Press');

    // Now let the API call resolve with the real, server-assigned ID
    await waitFor(() =>
      resolveAdd({
        id: 999,
        plan_day_id: 100,
        exercise_id: 1,
        order_number: 1,
        target_sets: 1,
        target_reps: null,
        target_weight: null,
        target_duration_seconds: null,
        has_reps: true,
        has_weight: true,
        has_duration: false,
        set_targets: [],
        notes: '',
        exercise_name: 'Bench Press',
        video_url: 'https://youtube.com/watch?v=test1',
      })
    );

    // A subsequent edit must target the real ID (999), not the temporary one used during
    // the optimistic window — this is the reconciliation this test exists to verify.
    // (Quick-added exercises are auto-expanded, so no need to click an expand toggle.)
    await user.click(await screen.findByRole('button', { name: 'Reps ✕' }));

    await waitFor(() =>
      expect(vi.mocked(updateExerciseInDay)).toHaveBeenCalledWith(5, 100, 999, { has_reps: false })
    );
  });

  it('keeps showing the real exercise name after reconciliation, even though the backend response omits it', async () => {
    // POST /days/{day_id}/exercises intentionally returns a lean WorkoutExerciseResponse
    // with no exercise_name/video_url field — regression test for the exercise briefly
    // (permanently, pre-fix) showing as "Exercise {id}" once the optimistic temp entry
    // was reconciled with the real server response.
    const user = userEvent.setup();
    vi.mocked(client.get).mockResolvedValue({ data: emptyDayFixture } as any);
    const mockedExercisesApi = vi.mocked(exercisesApiModule.exercisesApi);
    mockedExercisesApi.create.mockResolvedValue({
      id: 1,
      name: 'Bench Press',
      video_url: 'https://youtube.com/watch?v=test1',
      muscle_group: 'chest',
      equipment: 'barbell',
      is_custom: false,
      logging_type: 'weights',
    });

    vi.mocked(addExerciseToDay).mockResolvedValue({
      id: 999,
      plan_day_id: 100,
      exercise_id: 1,
      order_number: 1,
      target_sets: 1,
      target_reps: null,
      target_weight: null,
      target_duration_seconds: null,
      has_reps: true,
      has_weight: true,
      has_duration: false,
      set_targets: [],
      notes: '',
      // No exercise_name / video_url — matches the real backend's lean response.
    } as any);

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Exercises');
    await user.click(screen.getByTestId('library-exercise-add'));

    await waitFor(() => expect(vi.mocked(addExerciseToDay)).toHaveBeenCalled());
    expect(await screen.findByText('Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Exercise 1')).not.toBeInTheDocument();
  });
});

describe('PlanBuilder Preview Panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock exercisesApi.list so availableExercises stays an array, not undefined
    const mocked = vi.mocked(exercisesApiModule.exercisesApi);
    mocked.list.mockResolvedValue([]);

    // Mock exercisesApi.create to return a new exercise
    mocked.create.mockResolvedValue({
      id: 1,
      name: 'Bench Press',
      video_url: 'https://youtube.com/watch?v=test1',
      muscle_group: 'chest',
      equipment: 'barbell',
      is_custom: false,
      logging_type: 'weights',
    });
  });

  it('displays preview panel with placeholder state by default', () => {
    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={true} draft={{ name: 'Test Plan', unitType: 'days', totalUnits: 1 }} />
      </BrowserRouter>
    );

    const previewPanel = screen.getByTestId('preview-panel');
    expect(previewPanel).toBeInTheDocument();
    expect(previewPanel).toHaveTextContent('No exercise selected');
  });

  it('updates preview panel when clicking Library exercise row', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={true} draft={{ name: 'Test Plan', unitType: 'days', totalUnits: 1 }} />
      </BrowserRouter>
    );

    const previewButton = screen.getByTestId('library-exercise-preview');
    await user.click(previewButton);

    const previewPanel = screen.getByTestId('preview-panel');
    expect(previewPanel).toHaveTextContent('Preview: Bench Press');
  });

  it('updates preview panel when clicking Custom exercise row', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={true} draft={{ name: 'Test Plan', unitType: 'days', totalUnits: 1 }} />
      </BrowserRouter>
    );

    const customPreviewButton = screen.getByTestId('custom-exercise-preview');
    await user.click(customPreviewButton);

    const previewPanel = screen.getByTestId('preview-panel');
    expect(previewPanel).toHaveTextContent('Preview: Custom Exercise');
  });

  it('updates preview panel when switching between exercises', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={true} draft={{ name: 'Test Plan', unitType: 'days', totalUnits: 1 }} />
      </BrowserRouter>
    );

    const previewPanel = screen.getByTestId('preview-panel');

    const libraryPreviewButton = screen.getByTestId('library-exercise-preview');
    await user.click(libraryPreviewButton);
    expect(previewPanel).toHaveTextContent('Preview: Bench Press');

    const customPreviewButton = screen.getByTestId('custom-exercise-preview');
    await user.click(customPreviewButton);
    expect(previewPanel).toHaveTextContent('Preview: Custom Exercise');
  });

  it('adds exercise without interfering with preview functionality', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={true} draft={{ name: 'Test Plan', unitType: 'days', totalUnits: 1 }} />
      </BrowserRouter>
    );

    // Click add button
    const addButton = screen.getByTestId('library-exercise-add');
    await user.click(addButton);

    // Preview panel should still work
    const previewPanel = screen.getByTestId('preview-panel');
    const previewButton = screen.getByTestId('library-exercise-preview');
    await user.click(previewButton);

    expect(previewPanel).toHaveTextContent('Preview: Bench Press');
  });

  it('day-row input clicks do not trigger preview side effects', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={true} draft={{ name: 'Test Plan', unitType: 'days', totalUnits: 1 }} />
      </BrowserRouter>
    );

    // Set initial preview
    const libraryPreviewButton = screen.getByTestId('library-exercise-preview');
    await user.click(libraryPreviewButton);
    const previewPanel = screen.getByTestId('preview-panel');
    expect(previewPanel).toHaveTextContent('Preview: Bench Press');

    // Add an exercise via sidebar
    const addButton = screen.getByTestId('library-exercise-add');
    await user.click(addButton);

    // Verify preview still shows the originally selected exercise (Bench Press from the preview click)
    expect(previewPanel).toHaveTextContent('Preview: Bench Press');
  });

  it('clicking an exercise already in the day list previews it with its video_url', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={true} draft={{ name: 'Test Plan', unitType: 'days', totalUnits: 1 }} />
      </BrowserRouter>
    );

    // Add "Bench Press" (video_url set via the exercisesApi.create mock) to the day
    const addButton = screen.getByTestId('library-exercise-add');
    await user.click(addButton);

    // Click the real day-row rendered by PlanBuilder itself (not the mocked sidebar)
    // Exercise name and its order-number badge are now separate elements (order-number
    // badge overlays the thumbnail), so match on the name alone.
    const dayRowName = await screen.findByText('Bench Press');
    await user.click(dayRowName);

    const previewPanel = screen.getByTestId('preview-panel');
    expect(previewPanel).toHaveTextContent('Preview: Bench Press (has video)');
  });
});

describe('PlanBuilder Task 79: Optimistic Updates (Edit Mode)', () => {
  const daysFixture: WorkoutPlanDetail = {
    plan: {
      id: 5,
      user_id: 1,
      name: 'Edit Mode Plan',
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
            target_sets: 1,
            target_reps: '10',
            target_weight: null,
            target_duration_seconds: null,
            has_reps: true,
            has_weight: true,
            has_duration: false,
            set_targets: [],
            notes: '',
            exercise_name: 'Bench Press',
            video_url: null,
          },
        ],
      },
    ],
    weeks: null,
  };

  const weeksFixture = (week2Mode: 'linked' | 'custom', week2Days: WorkoutPlanDetail['days']): WorkoutPlanDetail => ({
    plan: {
      id: 5,
      user_id: 1,
      name: 'Weeks Plan',
      unit_type: 'weeks',
      total_units: 2,
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
          {
            id: 100,
            label: 'Mon',
            order_position: 1,
            is_rest: false,
            exercises: [
              {
                id: 200,
                plan_day_id: 100,
                exercise_id: 1,
                order_number: 1,
                target_sets: 1,
                target_reps: '10',
                target_weight: null,
                target_duration_seconds: null,
                has_reps: true,
                has_weight: true,
                has_duration: false,
                set_targets: [],
                notes: '',
                exercise_name: 'Bench Press',
                video_url: null,
              },
            ],
          },
        ],
      },
      {
        week_number: 2,
        mode: week2Mode,
        resolved_week_number: week2Mode === 'linked' ? 1 : 2,
        days: week2Days || [],
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const mocked = vi.mocked(exercisesApiModule.exercisesApi);
    mocked.list.mockResolvedValue([]);
  });

  it('toggling has_reps in edit mode patches local state without re-fetching the plan', async () => {
    const user = userEvent.setup();
    vi.mocked(client.get).mockResolvedValue({ data: daysFixture } as any);
    vi.mocked(updateExerciseInDay).mockResolvedValue({} as any);

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Bench Press');
    expect(vi.mocked(client.get)).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Expand Bench Press' }));
    await user.click(screen.getByRole('button', { name: 'Reps ✕' }));

    // Local state patch reflects the toggle immediately
    await screen.findByText('+ Reps');

    expect(vi.mocked(updateExerciseInDay)).toHaveBeenCalledWith(5, 100, 200, { has_reps: false });
    // The core Task 79 regression check: no second plan-detail fetch after the edit
    expect(vi.mocked(client.get)).toHaveBeenCalledTimes(1);
  });

  it('customizing a linked week deliberately re-fetches the plan to sync new backend IDs', async () => {
    const user = userEvent.setup();
    const customizedDays = [
      {
        id: 101,
        label: 'Mon',
        order_position: 1,
        is_rest: false,
        exercises: [
          {
            id: 201,
            plan_day_id: 101,
            exercise_id: 1,
            order_number: 1,
            target_sets: 1,
            target_reps: '10',
            target_weight: null,
            target_duration_seconds: null,
            has_reps: true,
            has_weight: true,
            has_duration: false,
            set_targets: [],
            notes: '',
            exercise_name: 'Bench Press',
            video_url: null,
          },
        ],
      },
    ];
    vi.mocked(client.get)
      .mockResolvedValueOnce({ data: weeksFixture('linked', []) } as any)
      .mockResolvedValueOnce({ data: weeksFixture('custom', customizedDays) } as any);
    vi.mocked(customizeWeek).mockResolvedValue(undefined as any);

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Mon');
    expect(vi.mocked(client.get)).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Week 2, linked' }));
    await user.click(await screen.findByRole('button', { name: 'Customize this week' }));

    // handleCustomizeWeek deliberately reloads (backend assigns new day/exercise IDs
    // that a local patch can't know in advance) — this is the one intentional exception.
    await waitFor(() => expect(vi.mocked(client.get)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(customizeWeek)).toHaveBeenCalledWith(5, 2);
  });
});

describe('PlanBuilder Copy/Paste Exercises', () => {
  const twoExerciseFixture: WorkoutPlanDetail = {
    plan: {
      id: 5,
      user_id: 1,
      name: 'Copy Paste Plan',
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
            target_reps: '10',
            target_weight: 135,
            target_duration_seconds: null,
            has_reps: true,
            has_weight: true,
            has_duration: false,
            set_targets: [],
            notes: 'go slow',
            exercise_name: 'Bench Press',
            video_url: null,
          },
          {
            id: 201,
            plan_day_id: 100,
            exercise_id: 2,
            order_number: 2,
            target_sets: 1,
            target_reps: '10',
            target_weight: null,
            target_duration_seconds: null,
            has_reps: true,
            has_weight: true,
            has_duration: false,
            set_targets: [],
            notes: '',
            exercise_name: 'Squat',
            video_url: null,
          },
        ],
      },
    ],
    weeks: null,
  };

  const emptyDayFixture: WorkoutPlanDetail = {
    ...twoExerciseFixture,
    days: [{ ...twoExerciseFixture.days![0], exercises: [] }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearClipboard();
    const mocked = vi.mocked(exercisesApiModule.exercisesApi);
    mocked.list.mockResolvedValue([]);
  });

  it('selecting exercises and copying stores them in the clipboard and exits select mode', async () => {
    const user = userEvent.setup();
    vi.mocked(client.get).mockResolvedValue({ data: twoExerciseFixture } as any);

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Bench Press');
    await user.click(screen.getByRole('button', { name: 'Select' }));

    await user.click(screen.getByRole('checkbox', { name: 'Select Bench Press' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Squat' }));

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(getClipboard()).toHaveLength(2));
    const clipboard = getClipboard();
    expect(clipboard.map((c) => c.exercise_name)).toEqual(['Bench Press', 'Squat']);
    expect(clipboard[0].notes).toBe('go slow');
    expect(clipboard[0].target_weight).toBe(135);

    // Select mode UI is gone (checkboxes removed, "Select" button back)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
  });

  it('clicking a single exercise\'s copy icon copies just that one exercise, with full fidelity', async () => {
    const user = userEvent.setup();
    vi.mocked(client.get).mockResolvedValue({ data: twoExerciseFixture } as any);

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Bench Press');

    // Copy only "Squat" via its row's copy icon — no Select mode involved.
    await user.click(screen.getByRole('button', { name: 'Copy Squat' }));

    await waitFor(() => expect(getClipboard()).toHaveLength(1));
    expect(getClipboard()[0]).toMatchObject({
      exercise_id: 2,
      exercise_name: 'Squat',
      target_sets: 1,
      target_reps: '10',
    });

    // Copying a different single exercise replaces the clipboard, doesn't add to it.
    await user.click(screen.getByRole('button', { name: 'Copy Bench Press' }));
    await waitFor(() => expect(getClipboard()).toHaveLength(1));
    expect(getClipboard()[0]).toMatchObject({ exercise_id: 1, exercise_name: 'Bench Press', notes: 'go slow', target_weight: 135 });
  });

  it('pasting appends the copied exercises to the target day via the API, in order', async () => {
    const user = userEvent.setup();
    setClipboard([
      {
        exercise_id: 1,
        exercise_name: 'Bench Press',
        video_url: null,
        target_sets: 3,
        target_reps: '10',
        target_weight: 135,
        target_duration_seconds: null,
        has_reps: true,
        has_weight: true,
        has_duration: false,
        notes: '',
        set_targets: [],
      },
      {
        exercise_id: 2,
        exercise_name: 'Squat',
        video_url: null,
        target_sets: 1,
        target_reps: '10',
        target_weight: null,
        target_duration_seconds: null,
        has_reps: true,
        has_weight: true,
        has_duration: false,
        notes: '',
        set_targets: [],
      },
    ]);

    vi.mocked(client.get).mockResolvedValue({ data: emptyDayFixture } as any);
    // Mirrors the real backend: addExerciseToDay's response has no exercise_name/video_url.
    vi.mocked(addExerciseToDay)
      .mockResolvedValueOnce({
        id: 300,
        plan_day_id: 100,
        exercise_id: 1,
        order_number: 1,
        target_sets: 3,
        target_reps: '10',
        target_weight: 135,
        target_duration_seconds: null,
        has_reps: true,
        has_weight: true,
        has_duration: false,
        set_targets: [],
        notes: '',
      } as any)
      .mockResolvedValueOnce({
        id: 301,
        plan_day_id: 100,
        exercise_id: 2,
        order_number: 2,
        target_sets: 1,
        target_reps: '10',
        target_weight: null,
        target_duration_seconds: null,
        has_reps: true,
        has_weight: true,
        has_duration: false,
        set_targets: [],
        notes: '',
      } as any);

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    const pasteButton = await screen.findByRole('button', { name: 'Paste 2 here' });
    await user.click(pasteButton);

    await screen.findByText('Bench Press');
    await screen.findByText('Squat');

    expect(vi.mocked(addExerciseToDay)).toHaveBeenNthCalledWith(1, 5, 100, 1, 3, '10', 135, undefined, true, true, false);
    expect(vi.mocked(addExerciseToDay)).toHaveBeenNthCalledWith(2, 5, 100, 2, 1, '10', undefined, undefined, true, true, false);
  });

  it('pasting an exercise with notes and custom set targets follows up with the corresponding API calls', async () => {
    const user = userEvent.setup();
    setClipboard([
      {
        exercise_id: 1,
        exercise_name: 'Bench Press',
        video_url: null,
        target_sets: 3,
        target_reps: '10',
        target_weight: 135,
        target_duration_seconds: null,
        has_reps: true,
        has_weight: true,
        has_duration: false,
        notes: 'go slow',
        set_targets: [{ set_number: 1, target_reps: '8', target_weight: 140, target_duration_seconds: null }],
      },
    ]);

    vi.mocked(client.get).mockResolvedValue({ data: emptyDayFixture } as any);
    vi.mocked(addExerciseToDay).mockResolvedValue({
      id: 300,
      plan_day_id: 100,
      exercise_id: 1,
      order_number: 1,
      target_sets: 3,
      target_reps: '10',
      target_weight: 135,
      target_duration_seconds: null,
      has_reps: true,
      has_weight: true,
      has_duration: false,
      set_targets: [],
      notes: '',
    } as any);
    vi.mocked(updateExerciseInDay).mockResolvedValue({
      id: 300,
      plan_day_id: 100,
      exercise_id: 1,
      order_number: 1,
      target_sets: 3,
      target_reps: '10',
      target_weight: 135,
      target_duration_seconds: null,
      has_reps: true,
      has_weight: true,
      has_duration: false,
      set_targets: [],
      notes: 'go slow',
    } as any);
    vi.mocked(replaceSetTargets).mockResolvedValue(undefined as any);

    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    const pasteButton = await screen.findByRole('button', { name: 'Paste 1 here' });
    await user.click(pasteButton);

    await waitFor(() => expect(vi.mocked(updateExerciseInDay)).toHaveBeenCalledWith(5, 100, 300, { notes: 'go slow' }));
    expect(vi.mocked(replaceSetTargets)).toHaveBeenCalledWith(5, 100, 300, [
      { set_number: 1, target_reps: '8', target_weight: 140, target_duration_seconds: null },
    ]);

    // Regression check: even with the backend's name-less response, the pasted
    // exercise still shows its real name, not "Exercise 1".
    expect(await screen.findByText('Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Exercise 1')).not.toBeInTheDocument();
  });

  it('clipboard persists across a full remount (e.g. navigating to a different plan)', async () => {
    const user = userEvent.setup();
    vi.mocked(client.get).mockResolvedValue({ data: twoExerciseFixture } as any);

    const { unmount } = render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={5} />
      </BrowserRouter>
    );

    await screen.findByText('Bench Press');
    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Bench Press' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(getClipboard()).toHaveLength(1));

    unmount();

    // Simulate navigating to a different plan: fresh mount, different planId.
    vi.mocked(client.get).mockResolvedValue({ data: emptyDayFixture } as any);
    render(
      <BrowserRouter>
        <PlanBuilder isCreateMode={false} planId={7} />
      </BrowserRouter>
    );

    // The "Paste 1 here" button appearing proves the clipboard survived the remount.
    expect(await screen.findByRole('button', { name: 'Paste 1 here' })).toBeInTheDocument();
  });
});
