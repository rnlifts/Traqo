import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PlanList from './PlanList';
import { en } from '../../i18n/en';

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));
import * as workoutPlansApi from '../../api/workoutPlansApi';
import * as sharingApi from '../../api/sharingApi';

vi.mock('../../api/workoutPlansApi');
vi.mock('../../api/sharingApi');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('../../features/sharing/ShareDialog', () => ({
  ShareDialog: ({ isOpen, onClose, planId }: any) =>
    isOpen ? (
      <div data-testid="share-dialog" data-plan-id={planId}>
        Share Dialog for Plan {planId}
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const mockPlans = [
  { id: 1, name: 'Workout A', unit_type: 'days' as const, total_units: 5, user_id: 1, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
  { id: 2, name: 'Workout B', unit_type: 'weeks' as const, total_units: 8, user_id: 1, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
];

const mockSharedWithMe = [
  { plan_id: 10, plan_name: 'Coach Plan', token: 'tok-abc', owner_username: 'coach_sam', permission: 'log' as const },
];

describe('PlanList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no shared-with-me plans, so existing tests (which don't care about
    // this section) don't need to mock it individually.
    vi.mocked(sharingApi.sharingApi.getSharedWithMe).mockResolvedValue([]);
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

  it('renders Share button on each plan card and opens ShareDialog when clicked', async () => {
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

    // Assert Share buttons are rendered
    const shareButtons = screen.getAllByRole('button', { name: /Share/ });
    expect(shareButtons).toHaveLength(2); // One for each plan

    // Click the first Share button
    fireEvent.click(shareButtons[0]);

    // Assert ShareDialog opens with correct plan ID
    await waitFor(() => {
      const dialog = screen.getByTestId('share-dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('data-plan-id', '1');
    });
  });

  it('renders a Duplicate button on each plan card and duplicates the clicked one', async () => {
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockResolvedValue(mockPlans);
    vi.mocked(workoutPlansApi.duplicateWorkoutPlan).mockResolvedValue({} as any);

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading workout plans...')).not.toBeInTheDocument();
    });

    const duplicateButtons = screen.getAllByRole('button', { name: 'Duplicate plan' });
    expect(duplicateButtons).toHaveLength(2);

    fireEvent.click(duplicateButtons[0]); // "Workout A"

    await waitFor(() =>
      expect(vi.mocked(workoutPlansApi.duplicateWorkoutPlan)).toHaveBeenCalledWith(1, 'Workout A (Copy)')
    );
    // Refetches the list so the new plan appears
    await waitFor(() => expect(vi.mocked(workoutPlansApi.listWorkoutPlans)).toHaveBeenCalledTimes(2));
  });

  it('shows an error banner if duplicating a plan fails', async () => {
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockResolvedValue(mockPlans);
    vi.mocked(workoutPlansApi.duplicateWorkoutPlan).mockRejectedValue(new Error('network error'));

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading workout plans...')).not.toBeInTheDocument();
    });

    const duplicateButtons = screen.getAllByRole('button', { name: 'Duplicate plan' });
    fireEvent.click(duplicateButtons[0]);

    expect(await screen.findByText('network error')).toBeInTheDocument();
  });

  it('renders a "Shared with me" section header', async () => {
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Shared with me')).toBeInTheDocument();
    });
  });

  it('renders shared plans with owner username and permission tier', async () => {
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockResolvedValue([]);
    vi.mocked(sharingApi.sharingApi.getSharedWithMe).mockResolvedValue(mockSharedWithMe);

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Coach Plan')).toBeInTheDocument();
    });

    expect(screen.getByText(/coach_sam/)).toBeInTheDocument();
    expect(screen.getByText(/log/)).toBeInTheDocument();
  });

  it('renders empty-state note when nothing has been shared with the user', async () => {
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockResolvedValue([]);
    vi.mocked(sharingApi.sharingApi.getSharedWithMe).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Nothing shared with you yet — plans someone grants you access to will show up here.')
      ).toBeInTheDocument();
    });
  });

  it('navigates to /shared/{token} when a shared-plan card is clicked', async () => {
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockResolvedValue([]);
    vi.mocked(sharingApi.sharingApi.getSharedWithMe).mockResolvedValue(mockSharedWithMe);

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Coach Plan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Coach Plan'));

    expect(mockNavigate).toHaveBeenCalledWith('/shared/tok-abc');
  });

  it('does not let a "Shared with me" load failure block the main plans list', async () => {
    vi.mocked(workoutPlansApi.listWorkoutPlans).mockResolvedValue(mockPlans);
    vi.mocked(sharingApi.sharingApi.getSharedWithMe).mockRejectedValue(new Error('network error'));

    render(
      <BrowserRouter>
        <PlanList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Workout A')).toBeInTheDocument();
    });

    // The main "Saved plans" list must render fine despite the shared-with-me failure.
    expect(screen.getByText('Workout B')).toBeInTheDocument();
  });
});
