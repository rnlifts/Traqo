import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkoutPreviewList } from './WorkoutPreviewList';
import { en } from '../i18n/en';

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));

describe('WorkoutPreviewList', () => {
  it('renders the given title', () => {
    render(<WorkoutPreviewList title="Workout Preview" exercises={[]} />);
    expect(screen.getByText('Workout Preview')).toBeInTheDocument();
  });

  it('renders each exercise numbered, with name and set count only (no reps/weight)', () => {
    render(
      <WorkoutPreviewList
        title="Workout Preview"
        exercises={[
          { exercise_name: 'Bench Press', target_sets: 4 },
          { exercise_name: 'Lat Pulldown', target_sets: 3 },
        ]}
      />
    );

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('4 sets')).toBeInTheDocument();
    expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();
    expect(screen.getByText('3 sets')).toBeInTheDocument();

    // Numbered badges
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Must never render reps/weight — sets only.
    expect(screen.queryByText(/reps/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lbs/i)).not.toBeInTheDocument();
  });

  it('uses singular "set" for a count of 1', () => {
    render(
      <WorkoutPreviewList
        title="Workout Preview"
        exercises={[{ exercise_name: 'Plank', target_sets: 1 }]}
      />
    );
    expect(screen.getByText('1 set')).toBeInTheDocument();
  });

  it('omits the set count when target_sets is null', () => {
    render(
      <WorkoutPreviewList
        title="Workout Preview"
        exercises={[{ exercise_name: 'Freestyle', target_sets: null }]}
      />
    );
    expect(screen.getByText('Freestyle')).toBeInTheDocument();
    expect(screen.queryByText(/set/i)).not.toBeInTheDocument();
  });

  it('renders a friendly empty state when there are no exercises', () => {
    render(<WorkoutPreviewList title="Workout Preview" exercises={[]} />);
    expect(screen.getByText('No exercises yet.')).toBeInTheDocument();
  });

  it('falls back to "Exercise" when exercise_name is missing', () => {
    render(
      <WorkoutPreviewList title="Workout Preview" exercises={[{ target_sets: 2 }]} />
    );
    expect(screen.getByText('Exercise')).toBeInTheDocument();
  });
});
