import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { DashboardProgressPreview } from './DashboardProgressPreview';
import { en } from '../i18n/en';

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock('../api/progressApi', () => ({
  progressApi: {
    getExerciseProgress: vi.fn(),
  },
}));

const randomExercise = { exercise_id: 5, exercise_name: 'Bench Press' };

const progressFixture = {
  exercise_id: 5,
  exercise_name: 'Bench Press',
  sessions: [
    {
      session_id: 1,
      date: '2026-07-01T00:00:00Z',
      sets: [{ set_number: 1, weight: 60, reps: 5, notes: '', estimated_1rm: 70, is_weight_pr: false, is_reps_pr: false, is_e1rm_pr: false }],
      volume: 300,
      is_volume_pr: false,
    },
    {
      session_id: 2,
      date: '2026-08-01T00:00:00Z',
      sets: [{ set_number: 1, weight: 70, reps: 5, notes: '', estimated_1rm: 82, is_weight_pr: true, is_reps_pr: false, is_e1rm_pr: true }],
      volume: 350,
      is_volume_pr: true,
    },
  ],
  personal_records: {
    heaviest_weight: 70,
    heaviest_weight_date: '2026-08-01T00:00:00Z',
    best_estimated_1rm: 82,
    best_estimated_1rm_date: '2026-08-01T00:00:00Z',
    best_volume: 350,
    best_volume_date: '2026-08-01T00:00:00Z',
    most_reps: 5,
    most_reps_date: '2026-07-01T00:00:00Z',
  },
};

describe('DashboardProgressPreview', () => {
  let mockNavigate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  const renderComponent = (props: { randomExercise: typeof randomExercise | null }) =>
    render(
      <BrowserRouter>
        <DashboardProgressPreview {...props} />
      </BrowserRouter>
    );

  it('shows a "log a few workouts" prompt when there is no random exercise yet', () => {
    renderComponent({ randomExercise: null });

    expect(screen.getByText(/Log a few workouts/i)).toBeInTheDocument();
  });

  it('loads and renders the exercise name and chart once progress resolves', async () => {
    const { progressApi } = await import('../api/progressApi');
    (progressApi.getExerciseProgress as any).mockResolvedValue(progressFixture);

    renderComponent({ randomExercise });

    await waitFor(() => {
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
    });
    expect(progressApi.getExerciseProgress).toHaveBeenCalledWith(5);
  });

  it('"View Progress" navigates to the full exercise progress page', async () => {
    const user = userEvent.setup();
    const { progressApi } = await import('../api/progressApi');
    (progressApi.getExerciseProgress as any).mockResolvedValue(progressFixture);

    renderComponent({ randomExercise });

    const link = await screen.findByRole('button', { name: /View Progress/i });
    await user.click(link);

    expect(mockNavigate).toHaveBeenCalledWith('/exercises/5/progress');
  });

  it('shows a friendly message instead of crashing if the progress fetch fails', async () => {
    const { progressApi } = await import('../api/progressApi');
    (progressApi.getExerciseProgress as any).mockRejectedValue(new Error('network error'));

    renderComponent({ randomExercise });

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load progress/i)).toBeInTheDocument();
    });
  });
});
