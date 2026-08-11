import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShareWorkoutStarter } from './ShareWorkoutStarter';
import { en } from '../../i18n/en';

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));
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

  it('shows the day picker immediately, with no separate reveal step', () => {
    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockDaysData} token="test-token" />
      </MemoryRouter>
    );
    // No "Start workout" gate button anymore — chips are visible right away.
    expect(screen.queryByText('Start workout')).not.toBeInTheDocument();
    expect(screen.getByText('Chest Day')).toBeInTheDocument();
    expect(screen.getByText('Rest Day')).toBeInTheDocument();
  });

  it('renders a week picker for a weeks-type plan', () => {
    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockWeeksData} token="test-token" />
      </MemoryRouter>
    );

    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
  });

  it('shows a "Workout Preview" of the currently selected day\'s exercises (sets only, no reps/weight)', () => {
    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={mockDaysData} token="test-token" />
      </MemoryRouter>
    );

    expect(screen.getByText('Workout Preview')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('4 sets')).toBeInTheDocument();
    expect(screen.queryByText(/6-8/)).not.toBeInTheDocument();
    expect(screen.queryByText(/225/)).not.toBeInTheDocument();
  });

  it('updates the preview when a different day is selected', () => {
    const twoWorkoutDays = {
      ...mockDaysData,
      days: [
        mockDaysData.days[0],
        {
          id: 3,
          label: 'Leg Day',
          order_position: 2,
          is_rest: false,
          exercises: [
            { exercise_id: 2, exercise_name: 'Squats', order_number: 1, target_sets: 5, target_reps: '5', target_weight: 315, target_duration_seconds: null },
          ],
        },
      ],
    };

    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={twoWorkoutDays} token="test-token" />
      </MemoryRouter>
    );

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Leg Day'));

    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
  });

  it('does not show a preview or allow beginning on a rest day', () => {
    // Rest day chips are disabled, so they can't be clicked into selection —
    // test the case where a rest day is the initially selected day instead.
    const restDayFirst = {
      ...mockDaysData,
      days: [mockDaysData.days[1], mockDaysData.days[0]],
    };

    render(
      <MemoryRouter>
        <ShareWorkoutStarter data={restDayFirst} token="test-token" />
      </MemoryRouter>
    );

    expect(screen.queryByText('Workout Preview')).not.toBeInTheDocument();
    expect(screen.getByText('Begin workout →').closest('button')).toBeDisabled();
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

    fireEvent.click(screen.getByText('Begin workout →'));

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

    // Select week 2
    const allWeekButtons = screen.getAllByText(/Week/);
    fireEvent.click(allWeekButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Deadlifts')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Begin workout →'));

    await waitFor(() => {
      expect(sharingApi.sharingApi.startWorkoutViaShare).toHaveBeenCalledWith(
        'test-token',
        { plan_day_id: 2, week_number: 2 }
      );
    });
  });

  it('renders AnonymousWorkoutLogger when auth_token is absent', async () => {
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

    fireEvent.click(screen.getByText('Begin workout →'));

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

    fireEvent.click(screen.getByText('Begin workout →'));

    await waitFor(() => {
      expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
    });
  });
});
