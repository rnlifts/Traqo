import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { PlanBuilder } from './PlanBuilder';
import * as exercisesApiModule from '../../api/exercisesApi';

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
