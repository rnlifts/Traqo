import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { WeeklyActivityCalendar } from './WeeklyActivityCalendar';
import type { DayActivity } from '../api/dashboardApi';
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

const emptyWeek: DayActivity[] = [
  { day_label: 'Sun', date: '2026-08-09', has_workout: false, session_id: null },
  { day_label: 'Mon', date: '2026-08-10', has_workout: false, session_id: null },
  { day_label: 'Tue', date: '2026-08-11', has_workout: false, session_id: null },
  { day_label: 'Wed', date: '2026-08-12', has_workout: false, session_id: null },
  { day_label: 'Thu', date: '2026-08-13', has_workout: false, session_id: null },
  { day_label: 'Fri', date: '2026-08-14', has_workout: false, session_id: null },
  { day_label: 'Sat', date: '2026-08-15', has_workout: false, session_id: null },
];

describe('WeeklyActivityCalendar', () => {
  let mockNavigate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  const renderComponent = (days: DayActivity[]) =>
    render(
      <BrowserRouter>
        <WeeklyActivityCalendar days={days} />
      </BrowserRouter>
    );

  it('renders all 7 day labels in Sun-Sat order', () => {
    renderComponent(emptyWeek);

    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    labels.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it('shows a dash for days with no workout, and no clickable dot', () => {
    renderComponent(emptyWeek);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getAllByText('—')).toHaveLength(7);
  });

  it('renders a clickable dot for a day with a workout, and clicking it navigates to that session', async () => {
    const user = userEvent.setup();
    const week = emptyWeek.map((d, i) => (i === 2 ? { ...d, has_workout: true, session_id: 42 } : d));
    renderComponent(week);

    const dot = screen.getByRole('button', { name: /Tue/i });
    await user.click(dot);

    expect(mockNavigate).toHaveBeenCalledWith('/workout-history/42');
  });
});
