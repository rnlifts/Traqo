import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseLibrarySidebar } from './ExerciseLibrarySidebar';

vi.mock('../../api/exerciseLibraryApi', () => ({
  exerciseLibraryApi: {
    getMuscleGroups: vi.fn(),
    search: vi.fn(),
    getEquipmentOptions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../api/exercisesApi', () => ({
  exercisesApi: {
    list: vi.fn(),
    listCustomOnly: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
  })),
}));

describe('ExerciseLibrarySidebar', () => {
  let mockOnSelectExercise: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSelectExercise = vi.fn();
  });

  const renderComponent = () => {
    return render(<ExerciseLibrarySidebar onSelectExercise={mockOnSelectExercise} />);
  };

  describe('Create New Exercise affordance', () => {
    it('shows "Create New" button when search has no exact match', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest', 'Back']);
      (exerciseLibraryApi.search as any).mockResolvedValue([
        { id: 1, name: 'Bench Press', muscle_group: 'Chest', equipment: null, thumbnail_url: null },
      ]);

      renderComponent();

      const searchInput = screen.getByPlaceholderText('Search exercises...');
      await user.type(searchInput, 'Dumbbell');

      await waitFor(() => {
        expect(screen.getByText('+ Create New: "Dumbbell"')).toBeInTheDocument();
      });
    });

    it('hides "Create New" button when search has an exact match (case-insensitive)', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest', 'Back']);
      (exerciseLibraryApi.search as any).mockResolvedValue([
        { id: 1, name: 'Bench Press', muscle_group: 'Chest', equipment: null, thumbnail_url: null },
      ]);

      renderComponent();

      const searchInput = screen.getByPlaceholderText('Search exercises...');
      await user.type(searchInput, 'bench press');

      // Wait for search to complete
      await waitFor(() => {
        expect(exerciseLibraryApi.search).toHaveBeenCalledWith('bench press', undefined);
      });

      // Verify exact match suppresses "Create New"
      expect(screen.queryByText('Create New: "bench press"')).not.toBeInTheDocument();
    });

    it('hides "Create New" when search is empty', async () => {
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest']);
      (exerciseLibraryApi.search as any).mockResolvedValue([]);

      renderComponent();

      // Let the initial getMuscleGroups() effect settle before asserting,
      // so React doesn't warn about a state update outside of act().
      await waitFor(() => {
        expect(exerciseLibraryApi.getMuscleGroups).toHaveBeenCalled();
      });

      // No search query yet, so "Create New" should not appear
      expect(screen.queryByText(/Create New/)).not.toBeInTheDocument();
    });

    it('creates a custom exercise when "+ Create New" button is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest']);
      (exerciseLibraryApi.search as any).mockResolvedValue([]);
      (exercisesApi.create as any).mockResolvedValue({
        id: 999,
        name: 'Custom Exercise',
        muscle_group: null,
        equipment: null,
        video_url: null,
      });
      (exercisesApi.list as any).mockResolvedValue([]);

      const mockOnExerciseCreated = vi.fn();
      render(<ExerciseLibrarySidebar onSelectExercise={mockOnSelectExercise} onExerciseCreated={mockOnExerciseCreated} />);

      const searchInput = screen.getByPlaceholderText('Search exercises...');
      await user.type(searchInput, 'custom exercise');

      await waitFor(() => {
        expect(screen.getByText('+ Create New: "custom exercise"')).toBeInTheDocument();
      });

      const createNewButton = screen.getByText('+ Create New: "custom exercise"');
      await user.click(createNewButton);

      // Verify the exercise was created with title-cased name
      await waitFor(() => {
        expect(exercisesApi.create).toHaveBeenCalledWith({ name: 'Custom Exercise' });
      });

      // Verify onExerciseCreated was called
      await waitFor(() => {
        expect(mockOnExerciseCreated).toHaveBeenCalled();
      });
    });
  });

  describe('search debouncing', () => {
    it('debounces search calls (only calls API once after settling)', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest']);
      (exerciseLibraryApi.search as any).mockResolvedValue([
        { id: 1, name: 'Bench Press', muscle_group: 'Chest', equipment: null, thumbnail_url: null },
      ]);

      renderComponent();

      const searchInput = screen.getByPlaceholderText('Search exercises...');

      // Type multiple characters (simulating user input)
      await user.type(searchInput, 'bench');

      // Wait for debounce to complete
      await waitFor(() => {
        expect(exerciseLibraryApi.search).toHaveBeenCalledWith('bench', undefined);
      });

      // Should have been called only once, not once per character
      expect(exerciseLibraryApi.search).toHaveBeenCalledTimes(1);
    });
  });

  describe('exercise selection', () => {
    it('calls onSelectExercise when + Add button is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest']);
      (exerciseLibraryApi.search as any).mockResolvedValue([
        { id: 1, name: 'Bench Press', muscle_group: 'Chest', equipment: 'Barbell', thumbnail_url: null, video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      ]);

      renderComponent();

      const searchInput = screen.getByPlaceholderText('Search exercises...');
      await user.type(searchInput, 'bench');

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /\+ Add/i });
      await user.click(addButton);

      expect(mockOnSelectExercise).toHaveBeenCalledWith({
        name: 'Bench Press',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        muscle_group: 'Chest',
        equipment: 'Barbell',
      });
    });

    it('clears search after selecting an exercise', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest']);
      (exerciseLibraryApi.search as any).mockResolvedValue([
        { id: 1, name: 'Bench Press', muscle_group: 'Chest', equipment: null, thumbnail_url: null },
      ]);

      renderComponent();

      const searchInput = screen.getByPlaceholderText('Search exercises...') as HTMLInputElement;
      await user.type(searchInput, 'bench');

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /\+ Add/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(searchInput.value).toBe('');
      });
    });
  });

  describe('Tab switching', () => {
    it('switches to Custom Exercises tab when clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exercisesApi.listCustomOnly as any).mockResolvedValue([]);

      renderComponent();

      // Verify library tab is active initially
      await waitFor(() => {
        expect(exerciseLibraryApi.getMuscleGroups).toHaveBeenCalled();
      });

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      // Verify listCustomOnly was called
      await waitFor(() => {
        expect(exercisesApi.listCustomOnly).toHaveBeenCalled();
      });
    });

    it('switches back to Library tab when clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exercisesApi.listCustomOnly as any).mockResolvedValue([]);

      renderComponent();

      // Switch to custom tab
      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      await waitFor(() => {
        expect(exercisesApi.listCustomOnly).toHaveBeenCalled();
      });

      // Switch back to library tab
      const libraryTab = screen.getByRole('button', { name: 'Exercise Library' });
      await user.click(libraryTab);

      // Library search input should be visible
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search exercises...')).toBeInTheDocument();
      });
    });
  });

  describe('Custom Exercises tab', () => {
    it('fetches custom exercises only once on first tab switch', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exercisesApi.listCustomOnly as any).mockResolvedValue([]);

      renderComponent();

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });

      // First click
      await user.click(customTab);

      await waitFor(() => {
        expect(exercisesApi.listCustomOnly).toHaveBeenCalledTimes(1);
      });

      // Switch back to library
      const libraryTab = screen.getByRole('button', { name: 'Exercise Library' });
      await user.click(libraryTab);

      // Switch back to custom again
      await user.click(customTab);

      // Should still be 1 call (not 2)
      expect(exercisesApi.listCustomOnly).toHaveBeenCalledTimes(1);
    });

    it('shows empty state message when user has no custom exercises', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exercisesApi.listCustomOnly as any).mockResolvedValue([]);

      renderComponent();

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      await waitFor(() => {
        expect(screen.getByText("You haven't created any custom exercises yet.")).toBeInTheDocument();
      });
    });

    it('displays custom exercises in the list', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exercisesApi.listCustomOnly as any).mockResolvedValue([
        {
          id: 1,
          name: 'My Bench Press',
          muscle_group: 'Chest',
          equipment: 'Barbell',
          video_url: null,
          logging_type: 'weight_reps',
          is_custom: true,
        },
      ]);

      renderComponent();

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      await waitFor(() => {
        expect(screen.getByText('My Bench Press')).toBeInTheDocument();
      });
    });

    it('calls onSelectExercise when + Add is clicked on a custom exercise', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exercisesApi.listCustomOnly as any).mockResolvedValue([
        {
          id: 1,
          name: 'My Custom Exercise',
          muscle_group: null,
          equipment: null,
          video_url: null,
          logging_type: 'weight_reps',
          is_custom: true,
        },
      ]);

      renderComponent();

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      await waitFor(() => {
        expect(screen.getByText('My Custom Exercise')).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button', { name: /\+ Add/i });
      await user.click(addButtons[0]);

      expect(mockOnSelectExercise).toHaveBeenCalledWith({
        name: 'My Custom Exercise',
        video_url: null,
        muscle_group: null,
        equipment: null,
      });
    });

    it('deletes custom exercise on delete button click', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { useToast } = await import('../../components/Toast');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exercisesApi.listCustomOnly as any)
        .mockResolvedValueOnce([
          {
            id: 1,
            name: 'Exercise to Delete',
            muscle_group: null,
            equipment: null,
            video_url: null,
            logging_type: 'weight_reps',
            is_custom: true,
          },
        ])
        .mockResolvedValueOnce([]); // After delete

      (exercisesApi.delete as any).mockResolvedValue(undefined);

      const mockShowToast = vi.fn();
      (useToast as any).mockReturnValue({ showToast: mockShowToast });

      renderComponent();

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      await waitFor(() => {
        expect(screen.getByText('Exercise to Delete')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(exercisesApi.delete).toHaveBeenCalledWith(1);
        expect(mockShowToast).toHaveBeenCalledWith('Exercise deleted', 'success');
      });
    });

    it('shows error toast when delete fails', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { useToast } = await import('../../components/Toast');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      // Explicitly reset the mock to clear any leftover mockResolvedValueOnce state from previous tests
      (exercisesApi.listCustomOnly as any).mockReset();
      (exercisesApi.listCustomOnly as any).mockResolvedValue([
        {
          id: 1,
          name: 'Exercise in Use',
          muscle_group: 'Chest',
          equipment: 'Barbell',
          video_url: null,
          logging_type: 'weight_reps',
          is_custom: true,
        },
      ]);

      // Mock delete to reject with an error response
      (exercisesApi.delete as any).mockRejectedValue({
        response: {
          data: {
            error: 'Exercise is in use in an active workout',
          },
        },
      });

      const mockShowToast = vi.fn();
      (useToast as any).mockReturnValue({ showToast: mockShowToast });

      renderComponent();

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      // Wait for exercise to load, then find delete button (will fail if button doesn't render)
      await waitFor(() => {
        expect(screen.getByText('Exercise in Use')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      // Verify error toast was shown
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          'Exercise is in use in an active workout',
          'error'
        );
      });
    });

    it('opens edit form when Edit button is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      // Explicitly reset the mock to clear any leftover mockResolvedValueOnce state from previous tests
      (exercisesApi.listCustomOnly as any).mockReset();
      (exercisesApi.listCustomOnly as any).mockResolvedValue([
        {
          id: 42,
          name: 'My Bench Press',
          muscle_group: 'Chest',
          equipment: 'Barbell',
          video_url: 'https://youtube.com/watch?v=abc123',
          logging_type: 'weight_reps',
          is_custom: true,
        },
      ]);

      renderComponent();

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      // Wait for exercise to load, then find and click edit button (will fail if button doesn't render)
      await waitFor(() => {
        expect(screen.getByText('My Bench Press')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: 'Edit' });
      await user.click(editButton);

      // Verify form opened and is pre-filled with correct values
      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('My Bench Press');
        expect(nameInput).toBeInTheDocument();
      });

      const muscleGroupInput = screen.getByDisplayValue('Chest');
      expect(muscleGroupInput).toBeInTheDocument();

      const equipmentInput = screen.getByDisplayValue('Barbell');
      expect(equipmentInput).toBeInTheDocument();

      const videoUrlInput = screen.getByDisplayValue('https://youtube.com/watch?v=abc123');
      expect(videoUrlInput).toBeInTheDocument();
    });

    it('renders YouTube thumbnail for custom exercise with video_url', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      // Explicitly reset the mock to clear any leftover mockResolvedValueOnce state from previous tests
      (exercisesApi.listCustomOnly as any).mockReset();
      (exercisesApi.listCustomOnly as any).mockResolvedValue([
        {
          id: 1,
          name: 'Exercise with Video',
          muscle_group: 'Chest',
          equipment: null,
          video_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
          logging_type: 'weight_reps',
          is_custom: true,
        },
      ]);

      renderComponent();

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      // Wait for exercise to load, then verify thumbnail image is rendered
      await waitFor(() => {
        expect(screen.getByText('Exercise with Video')).toBeInTheDocument();
      });

      // This will fail if the thumbnail image doesn't exist
      const thumbnailImage = screen.getByAltText('Exercise with Video') as HTMLImageElement;
      expect(thumbnailImage).toBeInTheDocument();
      expect(thumbnailImage.src).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    it('renders placeholder icon for custom exercise without video_url', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      // Explicitly reset the mock to clear any leftover mockResolvedValueOnce state from previous tests
      (exercisesApi.listCustomOnly as any).mockReset();
      (exercisesApi.listCustomOnly as any).mockResolvedValue([
        {
          id: 1,
          name: 'Exercise without Video',
          muscle_group: null,
          equipment: null,
          video_url: null,
          logging_type: 'weight_reps',
          is_custom: true,
        },
      ]);

      const { container } = render(<ExerciseLibrarySidebar onSelectExercise={mockOnSelectExercise} />);

      const customTab = screen.getByRole('button', { name: 'Custom Exercises' });
      await user.click(customTab);

      // Wait for exercise to load and verify placeholder icon is rendered
      await waitFor(() => {
        expect(screen.getByText('Exercise without Video')).toBeInTheDocument();
      });

      // This will fail if the placeholder icon isn't rendered
      const bodyText = container.textContent || '';
      expect(bodyText).toContain('🏋️');
    });


  });

  describe('Create New Exercise from search (complete flow)', () => {
    it('title-cases the exercise name when creating from search', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.search as any).mockResolvedValue([]);

      const newExercise = {
        id: 1,
        name: 'Dumbbell Curl',
        muscle_group: null,
        equipment: null,
        video_url: null,
        logging_type: 'weight_reps',
        is_custom: true,
      };

      (exercisesApi.create as any).mockResolvedValue(newExercise);
      (exercisesApi.listCustomOnly as any).mockResolvedValue([newExercise]);

      render(
        <ExerciseLibrarySidebar onSelectExercise={mockOnSelectExercise} />
      );

      // Type in search
      const searchInput = screen.getByPlaceholderText('Search exercises...');
      await user.type(searchInput, 'dumbbell curl');

      await waitFor(() => {
        expect(screen.getByText('+ Create New: "dumbbell curl"')).toBeInTheDocument();
      });

      // Click "Create New"
      const createNewButton = screen.getByText('+ Create New: "dumbbell curl"');
      await user.click(createNewButton);

      // Verify it was title-cased
      await waitFor(() => {
        expect(exercisesApi.create).toHaveBeenCalledWith({ name: 'Dumbbell Curl' });
      });
    });

    it('calls onExerciseCreated callback when exercise is created via Create New', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest']);
      (exerciseLibraryApi.search as any).mockResolvedValue([]);

      const newExercise = {
        id: 1,
        name: 'Custom Bench Press',
        muscle_group: null,
        equipment: null,
        video_url: null,
        logging_type: 'weight_reps',
        is_custom: true,
      };

      (exercisesApi.create as any).mockResolvedValue(newExercise);
      (exercisesApi.listCustomOnly as any).mockResolvedValue([newExercise]);

      const mockOnExerciseCreated = vi.fn();
      render(
        <ExerciseLibrarySidebar
          onSelectExercise={mockOnSelectExercise}
          onExerciseCreated={mockOnExerciseCreated}
        />
      );

      // Type in search to trigger "Create New" button
      const searchInput = screen.getByPlaceholderText('Search exercises...');
      await user.type(searchInput, 'custom bench press');

      await waitFor(() => {
        expect(screen.getByText('+ Create New: "custom bench press"')).toBeInTheDocument();
      });

      // Click "Create New" button
      const createNewButton = screen.getByText('+ Create New: "custom bench press"');
      await user.click(createNewButton);

      // Verify exercise was created
      await waitFor(() => {
        expect(exercisesApi.create).toHaveBeenCalledWith({ name: 'Custom Bench Press' });
      });

      // Verify onExerciseCreated callback was called
      expect(mockOnExerciseCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Custom Bench Press',
        })
      );
    });
  });
});
