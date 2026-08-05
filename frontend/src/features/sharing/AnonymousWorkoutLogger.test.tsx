import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AnonymousWorkoutLogger } from './AnonymousWorkoutLogger';
import * as sharingApi from '../../api/sharingApi';
import type { SharedPlanExercise } from '../../api/sharingApi';

vi.mock('../../api/sharingApi');
vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    Toast: null,
    showToast: vi.fn(),
  }),
}));

const mockExercises: SharedPlanExercise[] = [
  {
    exercise_id: 1,
    exercise_name: 'Bench Press',
    order_number: 1,
    target_sets: 4,
    target_reps: '6-8',
    target_weight: 225,
    target_duration_seconds: null,
    notes: 'Focus on form',
  },
  {
    exercise_id: 2,
    exercise_name: 'Incline Dumbbell Press',
    order_number: 2,
    target_sets: 3,
    target_reps: '8-10',
    target_weight: 70,
    target_duration_seconds: null,
  },
];

describe('AnonymousWorkoutLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the exercise list', () => {
    render(
      <MemoryRouter>
        <AnonymousWorkoutLogger
          token="test-token"
          sessionId={123}
          exercises={mockExercises}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Incline Dumbbell Press')).toBeInTheDocument();
    expect(screen.getByText('Log your sets')).toBeInTheDocument();
  });

  it('logs a set and displays it in the list', async () => {
    vi.mocked(sharingApi.sharingApi.addSetViaShare).mockResolvedValue({
      set_id: 1,
      set_number: 1,
    });

    const { container } = render(
      <MemoryRouter>
        <AnonymousWorkoutLogger
          token="test-token"
          sessionId={123}
          exercises={mockExercises}
        />
      </MemoryRouter>
    );

    // Get the weight input for the first exercise
    const weightInputs = container.querySelectorAll('input[placeholder="lbs"]');
    const repsInputs = container.querySelectorAll('input[placeholder="reps"]');

    fireEvent.change(weightInputs[0], { target: { value: '225' } });
    fireEvent.change(repsInputs[0], { target: { value: '8' } });

    const logButtons = screen.getAllByText('Log set');
    fireEvent.click(logButtons[0]);

    await waitFor(() => {
      expect(sharingApi.sharingApi.addSetViaShare).toHaveBeenCalledWith(
        'test-token',
        123,
        {
          exercise_id: 1,
          weight: 225,
          reps: 8,
        }
      );
    });

    // Check that the logged set appears
    await waitFor(() => {
      expect(screen.getByText(/Set 1/)).toBeInTheDocument();
      expect(screen.getByText(/225lbs/)).toBeInTheDocument();
      expect(screen.getByText(/8reps/)).toBeInTheDocument();
    });
  });

  it('shows validation error when submitting empty weight and reps', async () => {
    const mockShowToast = vi.fn();
    vi.doMock('../../components/Toast', () => ({
      useToast: () => ({
        Toast: null,
        showToast: mockShowToast,
      }),
    }));

    render(
      <MemoryRouter>
        <AnonymousWorkoutLogger
          token="test-token"
          sessionId={123}
          exercises={mockExercises}
        />
      </MemoryRouter>
    );

    const logButtons = screen.getAllByText('Log set');
    fireEvent.click(logButtons[0]);

    // API should not be called
    await waitFor(() => {
      expect(sharingApi.sharingApi.addSetViaShare).not.toHaveBeenCalled();
    });
  });

  it('calls finishWorkoutViaShare and shows completion message', async () => {
    vi.mocked(sharingApi.sharingApi.finishWorkoutViaShare).mockResolvedValue({
      message: 'Workout finished',
    });

    render(
      <MemoryRouter>
        <AnonymousWorkoutLogger
          token="test-token"
          sessionId={123}
          exercises={mockExercises}
        />
      </MemoryRouter>
    );

    const finishButton = screen.getByText('Finish workout');
    fireEvent.click(finishButton);

    await waitFor(() => {
      expect(sharingApi.sharingApi.finishWorkoutViaShare).toHaveBeenCalledWith(
        'test-token',
        123
      );
    });

    // Completion message should be shown
    await waitFor(() => {
      expect(screen.getByText('Workout complete')).toBeInTheDocument();
      expect(screen.getByText(/Thanks for logging/)).toBeInTheDocument();
    });
  });

  it('does not navigate anywhere after finishing', async () => {
    vi.mocked(sharingApi.sharingApi.finishWorkoutViaShare).mockResolvedValue({
      message: 'Workout finished',
    });

    const mockNavigate = vi.fn();
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    render(
      <MemoryRouter>
        <AnonymousWorkoutLogger
          token="test-token"
          sessionId={123}
          exercises={mockExercises}
        />
      </MemoryRouter>
    );

    const finishButton = screen.getByText('Finish workout');
    fireEvent.click(finishButton);

    await waitFor(() => {
      expect(screen.getByText(/Thanks for logging/)).toBeInTheDocument();
    });

    // Verify useNavigate was not called
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clears inputs after successfully logging a set', async () => {
    vi.mocked(sharingApi.sharingApi.addSetViaShare).mockResolvedValue({
      set_id: 1,
      set_number: 1,
    });

    const { container } = render(
      <MemoryRouter>
        <AnonymousWorkoutLogger
          token="test-token"
          sessionId={123}
          exercises={mockExercises}
        />
      </MemoryRouter>
    );

    const weightInputs = container.querySelectorAll('input[placeholder="lbs"]') as NodeListOf<HTMLInputElement>;
    const repsInputs = container.querySelectorAll('input[placeholder="reps"]') as NodeListOf<HTMLInputElement>;

    fireEvent.change(weightInputs[0], { target: { value: '225' } });
    fireEvent.change(repsInputs[0], { target: { value: '8' } });

    const logButtons = screen.getAllByText('Log set');
    fireEvent.click(logButtons[0]);

    await waitFor(() => {
      expect(sharingApi.sharingApi.addSetViaShare).toHaveBeenCalled();
    });

    // Inputs should be cleared
    await waitFor(() => {
      expect(weightInputs[0].value).toBe('');
      expect(repsInputs[0].value).toBe('');
    });
  });

  it('logs multiple sets for the same exercise', async () => {
    vi.mocked(sharingApi.sharingApi.addSetViaShare)
      .mockResolvedValueOnce({
        set_id: 1,
        set_number: 1,
      })
      .mockResolvedValueOnce({
        set_id: 2,
        set_number: 2,
      });

    const { container } = render(
      <MemoryRouter>
        <AnonymousWorkoutLogger
          token="test-token"
          sessionId={123}
          exercises={mockExercises}
        />
      </MemoryRouter>
    );

    const weightInputs = container.querySelectorAll('input[placeholder="lbs"]');
    const repsInputs = container.querySelectorAll('input[placeholder="reps"]');

    // Log first set
    fireEvent.change(weightInputs[0], { target: { value: '225' } });
    fireEvent.change(repsInputs[0], { target: { value: '8' } });
    const logButtons = screen.getAllByText('Log set');
    fireEvent.click(logButtons[0]);

    await waitFor(() => {
      expect(sharingApi.sharingApi.addSetViaShare).toHaveBeenCalledTimes(1);
    });

    // Log second set
    fireEvent.change(weightInputs[0], { target: { value: '225' } });
    fireEvent.change(repsInputs[0], { target: { value: '6' } });
    fireEvent.click(logButtons[0]);

    await waitFor(() => {
      expect(sharingApi.sharingApi.addSetViaShare).toHaveBeenCalledTimes(2);
    });

    // Both sets should be visible
    await waitFor(() => {
      expect(screen.getByText(/Set 1/)).toBeInTheDocument();
      expect(screen.getByText(/Set 2/)).toBeInTheDocument();
    });
  });
});
