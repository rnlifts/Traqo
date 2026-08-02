import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PlanList from './PlanList';
import * as workoutPlansApi from '../../api/workoutPlansApi';

vi.mock('../../api/workoutPlansApi');

const mockPlans = [
  { id: 1, name: 'Workout A', unit_type: 'days' as const, total_units: 5, user_id: 1, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
  { id: 2, name: 'Workout B', unit_type: 'weeks' as const, total_units: 8, user_id: 1, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
];

describe('PlanList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and action cards during loading state', async () => {
    // Mock listWorkoutPlans with a promise that never resolves
    const unresolvingPromise = new Promise(() => {});
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockReturnValue(unresolvingPromise as any);

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    // Assert page shell is visible during loading
    expect(screen.getByText('Your ledger')).toBeInTheDocument();
    expect(screen.getByText('Workout Plans')).toBeInTheDocument();
    expect(screen.getByText('Saved plans')).toBeInTheDocument();

    // Assert action cards are visible (they contain Create Plan and Log Workout buttons)
    expect(screen.getByRole('button', { name: /Create Plan|Create/i })).toBeInTheDocument();

    // Assert loading indicator is shown in plan-grid area
    expect(screen.getByText('Loading workout plans...')).toBeInTheDocument();
  });

  it('hides loading indicator and shows plan grid when plans load', async () => {
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockResolvedValue(mockPlans);

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    // Wait for plans to load
    await waitFor(() => {
      expect(screen.queryByText('Loading workout plans...')).not.toBeInTheDocument();
    });

    // Assert plans are rendered
    expect(screen.getByText('Workout A')).toBeInTheDocument();
    expect(screen.getByText('Workout B')).toBeInTheDocument();
    expect(screen.getByText('5 DAYS')).toBeInTheDocument();
    expect(screen.getByText('8 WEEKS')).toBeInTheDocument();
  });

  it('renders empty state when plan list is empty', async () => {
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading workout plans...')).not.toBeInTheDocument();
    });

    // Assert empty state message is shown
    expect(screen.getByText('Nothing saved yet — plans you create will show up here.')).toBeInTheDocument();

    // Assert page shell is still visible
    expect(screen.getByText('Your ledger')).toBeInTheDocument();
    expect(screen.getByText('Workout Plans')).toBeInTheDocument();
  });
});
