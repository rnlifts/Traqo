import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseLibrarySidebar } from './ExerciseLibrarySidebar';

vi.mock('../../api/exerciseLibraryApi', () => ({
  exerciseLibraryApi: {
    getMuscleGroups: vi.fn(),
    search: vi.fn(),
  },
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
        expect(screen.getByText('Create New: "Dumbbell"')).toBeInTheDocument();
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

    it('calls onSelectExercise when Create New button is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest']);
      (exerciseLibraryApi.search as any).mockResolvedValue([]);

      renderComponent();

      const searchInput = screen.getByPlaceholderText('Search exercises...');
      await user.type(searchInput, 'Custom Exercise');

      await waitFor(() => {
        expect(screen.getByText('Create New: "Custom Exercise"')).toBeInTheDocument();
      });

      const createNewButton = screen.getByText('Create New: "Custom Exercise"');
      await user.click(createNewButton);

      expect(mockOnSelectExercise).toHaveBeenCalledWith('Custom Exercise');
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
        { id: 1, name: 'Bench Press', muscle_group: 'Chest', equipment: 'Barbell', thumbnail_url: null },
      ]);

      renderComponent();

      const searchInput = screen.getByPlaceholderText('Search exercises...');
      await user.type(searchInput, 'bench');

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /\+ Add/i });
      await user.click(addButton);

      expect(mockOnSelectExercise).toHaveBeenCalledWith('Bench Press');
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
});
