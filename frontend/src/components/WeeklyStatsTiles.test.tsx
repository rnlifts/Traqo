import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeeklyStatsTiles } from './WeeklyStatsTiles';
import { en } from '../i18n/en';

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));

describe('WeeklyStatsTiles', () => {
  it('renders workout count, formatted volume, and PR count', () => {
    render(
      <WeeklyStatsTiles stats={{ workout_count: 4, total_volume: 12400, pr_count: 2 }} />
    );

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Workouts')).toBeInTheDocument();
    expect(screen.getByText('12.4k kg')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('PRs')).toBeInTheDocument();
  });

  it('shows a plain number (no "k") for volume under 1000', () => {
    render(<WeeklyStatsTiles stats={{ workout_count: 1, total_volume: 250, pr_count: 0 }} />);

    expect(screen.getByText('250 kg')).toBeInTheDocument();
  });

  it('renders all zeros cleanly for a week with no activity', () => {
    render(<WeeklyStatsTiles stats={{ workout_count: 0, total_volume: 0, pr_count: 0 }} />);

    expect(screen.getByText('0 kg')).toBeInTheDocument();
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(2); // workout_count and pr_count
  });
});
