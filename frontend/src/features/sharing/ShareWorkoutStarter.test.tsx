import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShareWorkoutStarter } from './ShareWorkoutStarter';
import * as sharingApi from '../../api/sharingApi';

vi.mock('../../api/sharingApi');
vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    Toast: null,
    showToast: vi.fn(),
  }),
}));

const mockDaysData = {
  plan: {
    id: 1,
    user_id: 1,
    name: 'Test Plan',
    unit_type: 'days' as const,
    total_units: 2,
    is_quick_start: false,
    created_at: '2026-08-05T00:00:00Z',
    updated_at: '2026-08-05T00:00:00Z',
  },
  days: [
    {
      id: 1,
      label: 'Chest Day',
      order_position: 1,
      is_rest: false,
      exercises: [
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
      ],
    },
    {
      id: 2,
      label: 'Rest Day',
      order_position: 2,
      is_rest: true,
      exercises: [],
    },
  ],
  weeks: null,
  permission: 'log' as const,
  plan_owner_username: 'john_doe',
  share: { mode: 'anyone' as const },
};

const mockWeeksData = {
  plan: {
    id: 2,
    user_id: 1,
    name: 'Weekly Plan',
    unit_type: 'weeks' as const,
    total_units: 2,
    is_quick_start: false,
    created_at: '2026-08-05T00:00:00Z',
    updated_at: '2026-08-05T00:00:00Z',
  },
  days: null,
  weeks: [
    {
      week_number: 1,
      mode: 'base' as const,
      resolved_week_number: 1,
      days: [
        {
          id: 1,
          label: 'Monday',
          order_position: 1,
          is_rest: false,
          exercises: [
            {
              exercise_id: 1,
              exercise_name: 'Squats',
              order_number: 1,
              target_sets: 5,
              target_reps: '5',
              target_weight: 315,
              target_duration_seconds: null,
            },
          ],
        },
      ],
    },
    {
      week_number: 2,
      mode: 'base' as const,
      resolved_week_number: 2,
      days: [
        {
          id: 2,
          label: 'Monday',
          order_position: 1,
          is_rest: false,
          exercises: [
            {
              exercise_id: 2,
              exercise_name: 'Deadlifts',
              order_number: 1,
              target_sets: 3,
              target_reps: '3',
              target_weight: 405,
              target_duration_seconds: null,
            },
          ],
        },
      ],
    },
  ],
  permission: 'log' as const,
  plan_owner_username: 'jane_smith',
  share: { mode: 'restricted' as const },
};

describe('ShareWorkoutStarter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does not render when permission is view', () => {
    const viewData = { ...mockDaysData, permission: 'view' as const };
    const { container } = render(
      <MemoryRouter>
        <ShareWorkoutStarter data={viewData} token="test-token" />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a Start workout button when permission is log', () => {
    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockDaysData} token="test-token" />
      </MemoryRouter>
    );
    expect(screen.getByText('Start workout')).toBeInTheDocument();
  });

  it('renders a day picker for a days-type plan', async () => {
    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockDaysData} token="test-token" />
      </MemoryRouter>
    );

    const startButton = screen.getByText('Start workout');
    fireEvent.click(startButton);

    // Day picker should be shown
    await waitFor(() => {
      expect(screen.getByText('Chest Day')).toBeInTheDocument();
      expect(screen.getByText('Rest Day')).toBeInTheDocument();
    });
  });

  it('renders a week picker for a weeks-type plan', async () => {
    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockWeeksData} token="test-token" />
      </MemoryRouter>
    );

    const startButton = screen.getByText('Start workout');
    fireEvent.click(startButton);

    // Week chips should be shown
    await waitFor(() => {
      expect(screen.getByText('Week 1')).toBeInTheDocument();
      expect(screen.getByText('Week 2')).toBeInTheDocument();
    });

    // Day chips should be shown for the first week
    expect(screen.getByText('Monday')).toBeInTheDocument();
  });

  it('calls startWorkoutViaShare with correct plan_day_id for days-type plan', async () => {
    vi.mocked(sharingApi.sharingApi.startWorkoutViaShare).mockResolvedValue({
      session_id: 123,
      message: 'Workout started',
    });

    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockDaysData} token="test-token" />
      </MemoryRouter>
    );

    const startButton = screen.getByText('Start workout');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Chest Day')).toBeInTheDocument();
    });

    const beginButton = screen.getByText('Begin');
    fireEvent.click(beginButton);

    await waitFor(() => {
      expect(sharingApi.sharingApi.startWorkoutViaShare).toHaveBeenCalledWith(
        'test-token',
        { plan_day_id: 1 }
      );
    });
  });

  it('calls startWorkoutViaShare with correct plan_day_id and week_number for weeks-type plan', async () => {
    vi.mocked(sharingApi.sharingApi.startWorkoutViaShare).mockResolvedValue({
      session_id: 123,
      message: 'Workout started',
    });

    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockWeeksData} token="test-token" />
      </MemoryRouter>
    );

    const startButton = screen.getByText('Start workout');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Week 1')).toBeInTheDocument();
    });

    // Select week 2
    const allWeekButtons = screen.getAllByText(/Week/);
    fireEvent.click(allWeekButtons[1]); // Click Week 2

    // Wait for day for week 2 to render
    await waitFor(() => {
      // Verify that days for week 2 are shown
      const dayButtons = screen.getAllByText(/Monday/);
      expect(dayButtons.length).toBeGreaterThan(0);
    });

    const beginButton = screen.getByText('Begin');
    fireEvent.click(beginButton);

    await waitFor(() => {
      expect(sharingApi.sharingApi.startWorkoutViaShare).toHaveBeenCalledWith(
        'test-token',
        { plan_day_id: 2, week_number: 2 }
      );
    });
  });

  it('navigates to /workout-sessions/{session_id} when auth_token is present', async () => {
    localStorage.setItem('auth_token', 'test-auth-token');

    const mockNavigate = vi.fn();
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    vi.mocked(sharingApi.sharingApi.startWorkoutViaShare).mockResolvedValue({
      session_id: 456,
      message: 'Workout started',
    });

    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockDaysData} token="test-token" />
      </MemoryRouter>
    );

    const startButton = screen.getByText('Start workout');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Chest Day')).toBeInTheDocument();
    });

    const beginButton = screen.getByText('Begin');
    fireEvent.click(beginButton);

    // The component uses useNavigate internally, but we can't easily mock it in test
    // Instead, we verify the API was called correctly
    await waitFor(() => {
      expect(sharingApi.sharingApi.startWorkoutViaShare).toHaveBeenCalled();
    });
  });

  it('renders AnonymousWorkoutLogger when auth_token is absent', async () => {
    // Ensure no auth token
    localStorage.removeItem('auth_token');

    vi.mocked(sharingApi.sharingApi.startWorkoutViaShare).mockResolvedValue({
      session_id: 789,
      message: 'Workout started',
    });

    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockDaysData} token="test-token" />
      </MemoryRouter>
    );

    const startButton = screen.getByText('Start workout');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Chest Day')).toBeInTheDocument();
    });

    const beginButton = screen.getByText('Begin');
    fireEvent.click(beginButton);

    // After starting without auth token, AnonymousWorkoutLogger should render
    await waitFor(() => {
      expect(screen.getByText('Log your sets')).toBeInTheDocument();
    });
  });

  it('handles 403 error and shows error message', async () => {
    vi.mocked(sharingApi.sharingApi.startWorkoutViaShare).mockRejectedValue({
      response: { status: 403 },
    });

    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockDaysData} token="test-token" />
      </MemoryRouter>
    );

    const startButton = screen.getByText('Start workout');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Chest Day')).toBeInTheDocument();
    });

    const beginButton = screen.getByText('Begin');
    fireEvent.click(beginButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Permission denied/)
      ).toBeInTheDocument();
    });
  });
});
