import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BodyStatsCard } from './BodyStatsCard';
import { en } from '../i18n/en';

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));

describe('BodyStatsCard', () => {
  it('renders BMI, BMR, and maintenance calories', () => {
    render(<BodyStatsCard bodyMetrics={{ bmi: 22.9, bmr: 1673.8, maintenance_calories: 2594 }} />);

    expect(screen.getByText('22.9')).toBeInTheDocument();
    expect(screen.getByText('1673.8 kcal')).toBeInTheDocument();
    expect(screen.getByText('2594 kcal')).toBeInTheDocument();
  });

  it('labels a normal-range BMI correctly', () => {
    render(<BodyStatsCard bodyMetrics={{ bmi: 22.9, bmr: 1673.8, maintenance_calories: 2594 }} />);
    expect(screen.getByText('Normal')).toBeInTheDocument();
  });

  it('labels an underweight BMI correctly', () => {
    render(<BodyStatsCard bodyMetrics={{ bmi: 17.5, bmr: 1400, maintenance_calories: 1800 }} />);
    expect(screen.getByText('Underweight')).toBeInTheDocument();
  });

  it('labels an overweight BMI correctly', () => {
    render(<BodyStatsCard bodyMetrics={{ bmi: 27, bmr: 1800, maintenance_calories: 2400 }} />);
    expect(screen.getByText('Overweight')).toBeInTheDocument();
  });

  it('labels an obese BMI correctly', () => {
    render(<BodyStatsCard bodyMetrics={{ bmi: 32, bmr: 2000, maintenance_calories: 2800 }} />);
    expect(screen.getByText('Obese')).toBeInTheDocument();
  });
});
