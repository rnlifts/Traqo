import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomExerciseForm } from './CustomExerciseForm';
import type { Exercise } from '../../api/exercisesApi';

vi.mock('../../api/exercisesApi', () => ({
  exercisesApi: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../api/exerciseLibraryApi', () => ({
  exerciseLibraryApi: {
    getMuscleGroups: vi.fn(),
    getEquipmentOptions: vi.fn(),
  },
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
  })),
}));

describe('CustomExerciseForm', () => {
  let mockOnSaved: any;
  let mockOnCancel: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSaved = vi.fn();
    mockOnCancel = vi.fn();
  });

  describe('Create mode', () => {
    it('submits form and calls exercisesApi.create() with entered values', async () => {
      const user = userEvent.setup({ delay: null });
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest', 'Back']);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue(['Barbell', 'Dumbbell']);

      const mockExercise: Exercise = {
        id: 1,
        name: 'Bench Press',
        muscle_group: 'Chest',
        equipment: 'Barbell',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        logging_type: 'weight_reps',
        is_custom: true,
      };

      (exercisesApi.create as any).mockResolvedValue(mockExercise);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      // Fill in form fields
      const nameInput = screen.getByPlaceholderText('Exercise name');
      const muscleGroupInput = screen.getByPlaceholderText('e.g. chest, back, biceps');
      const equipmentInput = screen.getByPlaceholderText('e.g. barbell, dumbbell, bodyweight');
      const videoUrlInput = screen.getByPlaceholderText(/https:\/\/youtube/);

      await user.type(nameInput, 'Bench Press');
      await user.type(muscleGroupInput, 'Chest');
      await user.type(equipmentInput, 'Barbell');
      await user.type(videoUrlInput, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });
      await user.click(submitButton);

      // Verify API was called
      await waitFor(() => {
        expect(exercisesApi.create).toHaveBeenCalledWith({
          name: 'Bench Press',
          muscle_group: 'Chest',
          equipment: 'Barbell',
          video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        });
      });

      // Verify onSaved callback was called
      expect(mockOnSaved).toHaveBeenCalledWith(mockExercise);
    });

    it('shows success toast when exercise is created', async () => {
      const user = userEvent.setup({ delay: null });
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { useToast } = await import('../../components/Toast');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      const mockExercise: Exercise = {
        id: 1,
        name: 'Test',
        muscle_group: null,
        equipment: null,
        video_url: null,
        logging_type: 'weight_reps',
        is_custom: true,
      };

      (exercisesApi.create as any).mockResolvedValue(mockExercise);

      const mockShowToast = vi.fn();
      (useToast as any).mockReturnValue({ showToast: mockShowToast });

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      await user.type(nameInput, 'Test Exercise');

      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Exercise created successfully', 'success');
      });
    });
  });

  describe('Edit mode', () => {
    it('pre-fills form from initialValues', async () => {
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      const initialValues = {
        id: 1,
        name: 'Bench Press',
        muscle_group: 'Chest',
        equipment: 'Barbell',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      };

      render(
        <CustomExerciseForm
          mode="edit"
          initialValues={initialValues}
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      // Wait for component to fully mount and effects to run
      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('Exercise name') as HTMLInputElement;
        expect(nameInput.value).toBe('Bench Press');
      });

      // Verify other fields are pre-filled
      const muscleGroupInput = screen.getByPlaceholderText('e.g. chest, back, biceps') as HTMLInputElement;
      const equipmentInput = screen.getByPlaceholderText('e.g. barbell, dumbbell, bodyweight') as HTMLInputElement;
      const videoUrlInput = screen.getByPlaceholderText(/https:\/\/youtube/) as HTMLInputElement;

      expect(muscleGroupInput.value).toBe('Chest');
      expect(equipmentInput.value).toBe('Barbell');
      expect(videoUrlInput.value).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('submits form and calls exercisesApi.update() not create()', async () => {
      const user = userEvent.setup({ delay: null });
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      const mockExercise: Exercise = {
        id: 1,
        name: 'Updated Name',
        muscle_group: 'Back',
        equipment: 'Dumbbell',
        video_url: null,
        logging_type: 'weight_reps',
        is_custom: true,
      };

      (exercisesApi.update as any).mockResolvedValue(mockExercise);

      const initialValues = {
        id: 1,
        name: 'Bench Press',
        muscle_group: 'Chest',
        equipment: 'Barbell',
        video_url: null,
      };

      render(
        <CustomExerciseForm
          mode="edit"
          initialValues={initialValues}
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      // Change name
      const nameInput = screen.getByPlaceholderText('Exercise name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Update Exercise/ });
      await user.click(submitButton);

      // Verify update was called (not create)
      await waitFor(() => {
        expect(exercisesApi.update).toHaveBeenCalledWith(1, {
          name: 'Updated Name',
          muscle_group: 'Chest',
          equipment: 'Barbell',
          video_url: null,
        });
        expect(exercisesApi.create).not.toHaveBeenCalled();
      });
    });

    it('shows success toast when exercise is updated', async () => {
      const user = userEvent.setup({ delay: null });
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { useToast } = await import('../../components/Toast');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      const mockExercise: Exercise = {
        id: 1,
        name: 'Test',
        muscle_group: null,
        equipment: null,
        video_url: null,
        logging_type: 'weight_reps',
        is_custom: true,
      };

      (exercisesApi.update as any).mockResolvedValue(mockExercise);

      const mockShowToast = vi.fn();
      (useToast as any).mockReturnValue({ showToast: mockShowToast });

      render(
        <CustomExerciseForm
          mode="edit"
          initialValues={{ id: 1, name: 'Test' }}
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Update Exercise/ });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Exercise updated successfully', 'success');
      });
    });
  });

  describe('YouTube URL validation', () => {
    it('shows error for invalid YouTube URL (e.g., Vimeo)', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const videoUrlInput = screen.getByPlaceholderText(/https:\/\/youtube/);
      await user.type(videoUrlInput, 'https://vimeo.com/123456');

      // Error should appear
      await waitFor(() => {
        expect(screen.getByText(/YouTube URL must contain/)).toBeInTheDocument();
      });
    });

    it('shows error and disables submit button when YouTube URL is invalid', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      const videoUrlInput = screen.getByPlaceholderText(/https:\/\/youtube/);
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });

      await user.type(nameInput, 'Test');
      await user.type(videoUrlInput, 'https://invalid.com');

      // Submit button should be disabled
      expect(submitButton).toBeDisabled();

      // Error message should be visible
      await waitFor(() => {
        expect(screen.getByText(/YouTube URL must contain/)).toBeInTheDocument();
      });
    });

    it('clears error and enables submit for valid youtube.com/watch URL', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      const videoUrlInput = screen.getByPlaceholderText(/https:\/\/youtube/);
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });

      await user.type(nameInput, 'Test');

      // Type invalid URL first
      await user.type(videoUrlInput, 'https://invalid.com');
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      // Clear and type valid URL
      await user.clear(videoUrlInput);
      await user.type(videoUrlInput, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      // Error should disappear and submit should be enabled
      expect(screen.queryByText(/YouTube URL must contain/)).not.toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });

    it('clears error and enables submit for valid youtu.be URL', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      const videoUrlInput = screen.getByPlaceholderText(/https:\/\/youtube/);
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });

      await user.type(nameInput, 'Test');
      await user.type(videoUrlInput, 'https://youtu.be/dQw4w9WgXcQ');

      // Error should not appear and submit should be enabled
      expect(screen.queryByText(/YouTube URL must contain/)).not.toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });

    it('allows empty video_url (optional field)', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      const mockExercise: Exercise = {
        id: 1,
        name: 'Test',
        muscle_group: null,
        equipment: null,
        video_url: null,
        logging_type: 'weight_reps',
        is_custom: true,
      };

      (exercisesApi.create as any).mockResolvedValue(mockExercise);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });

      await user.type(nameInput, 'Test');

      // Don't fill in video_url - should still be valid
      expect(submitButton).not.toBeDisabled();

      await user.click(submitButton);

      await waitFor(() => {
        expect(exercisesApi.create).toHaveBeenCalled();
      });
    });
  });

  describe('Free-text fields', () => {
    it('accepts arbitrary text for muscle_group (not restricted to dropdown)', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue(['Chest', 'Back']);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      const mockExercise: Exercise = {
        id: 1,
        name: 'Test',
        muscle_group: 'Custom Muscle',
        equipment: null,
        video_url: null,
        logging_type: 'weight_reps',
        is_custom: true,
      };

      (exercisesApi.create as any).mockResolvedValue(mockExercise);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      const muscleGroupInput = screen.getByPlaceholderText('e.g. chest, back, biceps');
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });

      await user.type(nameInput, 'Test');
      await user.type(muscleGroupInput, 'Custom Muscle');
      await user.click(submitButton);

      await waitFor(() => {
        expect(exercisesApi.create).toHaveBeenCalledWith(
          expect.objectContaining({
            muscle_group: 'Custom Muscle',
          })
        );
      });
    });

    it('accepts arbitrary text for equipment (not restricted to dropdown)', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { exercisesApi } = await import('../../api/exercisesApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue(['Barbell']);

      const mockExercise: Exercise = {
        id: 1,
        name: 'Test',
        muscle_group: null,
        equipment: 'Custom Equipment',
        video_url: null,
        logging_type: 'weight_reps',
        is_custom: true,
      };

      (exercisesApi.create as any).mockResolvedValue(mockExercise);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      const equipmentInput = screen.getByPlaceholderText('e.g. barbell, dumbbell, bodyweight');
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });

      await user.type(nameInput, 'Test');
      await user.type(equipmentInput, 'Custom Equipment');
      await user.click(submitButton);

      await waitFor(() => {
        expect(exercisesApi.create).toHaveBeenCalledWith(
          expect.objectContaining({
            equipment: 'Custom Equipment',
          })
        );
      });
    });
  });

  describe('Required fields', () => {
    it('disables submit button when name is empty', async () => {
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      // Wait for component to fully mount before checking button state
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Create Exercise/ });
        expect(submitButton).toBeDisabled();
      });
    });

    it('enables submit button when name is filled', async () => {
      const user = userEvent.setup({ delay: null });
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });

      await user.type(nameInput, 'Test Exercise');

      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('API error handling', () => {
    it('shows toast with error message on API failure', async () => {
      const user = userEvent.setup({ delay: null });
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { useToast } = await import('../../components/Toast');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      const mockShowToast = vi.fn();
      (useToast as any).mockReturnValue({ showToast: mockShowToast });

      const errorResponse = {
        response: {
          data: {
            error: 'An exercise with this name already exists',
          },
        },
      };

      (exercisesApi.create as any).mockRejectedValue(errorResponse);

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });

      await user.type(nameInput, 'Test');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          'An exercise with this name already exists',
          'error'
        );
      });

      // onSaved should not be called on error
      expect(mockOnSaved).not.toHaveBeenCalled();
    });

    it('shows generic error message when response has no error field', async () => {
      const user = userEvent.setup({ delay: null });
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');
      const { useToast } = await import('../../components/Toast');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      const mockShowToast = vi.fn();
      (useToast as any).mockReturnValue({ showToast: mockShowToast });

      (exercisesApi.create as any).mockRejectedValue(new Error('Network error'));

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name');
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ });

      await user.type(nameInput, 'Test');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          'Network error',
          'error'
        );
      });
    });
  });

  describe('Form behavior', () => {
    it('disables form fields while loading', async () => {
      const user = userEvent.setup({ delay: null });
      const { exercisesApi } = await import('../../api/exercisesApi');
      const { exerciseLibraryApi } = await import('../../api/exerciseLibraryApi');

      (exerciseLibraryApi.getMuscleGroups as any).mockResolvedValue([]);
      (exerciseLibraryApi.getEquipmentOptions as any).mockResolvedValue([]);

      // Make API call slow
      (exercisesApi.create as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 1, name: 'Test', muscle_group: null, equipment: null, video_url: null, logging_type: 'weight_reps', is_custom: true }), 1000))
      );

      render(
        <CustomExerciseForm
          mode="create"
          onSaved={mockOnSaved}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByPlaceholderText('Exercise name') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: /Create Exercise/ }) as HTMLButtonElement;

      await user.type(nameInput, 'Test');
      await user.click(submitButton);

      // Form fields should be disabled
      expect(nameInput.disabled).toBe(true);
      expect(submitButton.disabled).toBe(true);
    });
  });
});
