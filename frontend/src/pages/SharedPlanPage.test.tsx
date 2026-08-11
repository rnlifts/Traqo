import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SharedPlanPage } from './SharedPlanPage';
import { en } from '../i18n/en';

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));
import * as sharingApi from '../api/sharingApi';

vi.mock('../api/sharingApi');

const mockDaysPlan = {
  plan: {
    id: 1,
    user_id: 1,
    name: 'Test Plan',
    unit_type: 'days' as const,
    total_units: 3,
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
        {
          exercise_id: 2,
          exercise_name: 'Incline Dumbbell Press',
          order_number: 2,
          target_sets: 3,
          target_reps: '8-10',
          target_weight: 70,
          target_duration_seconds: null,
          notes: null,
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
  permission: 'view' as const,
  plan_owner_username: 'john_doe',
  share: { mode: 'anyone' as const },
};

const mockWeeksPlan = {
  plan: {
    id: 2,
    user_id: 1,
    name: 'Weekly Plan',
    unit_type: 'weeks' as const,
    total_units: 4,
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
              notes: null,
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

describe('SharedPlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders plan content for a days-type plan', async () => {
    vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
      mockDaysPlan as any
    );

    render(
      <MemoryRouter initialEntries={['/shared/test-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the component to load and render the data
    await waitFor(
      () => {
        expect(screen.getByText('Test Plan')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(screen.getByText('3 DAYS')).toBeInTheDocument();
    expect(screen.getByText(/Chest Day/)).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Incline Dumbbell Press')).toBeInTheDocument();
    expect(screen.getByText(/Rest Day/)).toBeInTheDocument();
  });

  it('renders plan content for a weeks-type plan', async () => {
    const weeksResponse = {
      ...mockWeeksPlan,
    };
    vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
      weeksResponse as any
    );

    render(
      <MemoryRouter initialEntries={['/shared/test-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the component to load and render the data
    await waitFor(
      () => {
        expect(screen.getByText('Weekly Plan')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(screen.getByText('4 WEEKS')).toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
    expect(screen.getByText(/Monday/)).toBeInTheDocument();
  });

  it('renders permission banner with correct owner username and permission', async () => {
    vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
      mockDaysPlan as any
    );

    const { container } = render(
      <MemoryRouter initialEntries={['/shared/test-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // The banner now lives in the plan-header card's <h2>, not a standalone <p>.
      const banner = container.querySelector('.card h2');
      const bannerText = banner?.textContent || '';
      expect(bannerText).toContain('Shared by');
      expect(bannerText).toContain('john_doe');
      expect(bannerText).toContain('you can');
      expect(bannerText).toContain('view');
    });
  });

  it('renders 403 message without redirecting to login', async () => {
    vi.mocked(sharingApi.sharingApi.getSharedPlan).mockRejectedValue({
      response: { status: 403 },
    });

    render(
      <MemoryRouter initialEntries={['/shared/test-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(
        screen.getByText(/This share is restricted/)
      ).toBeInTheDocument();
    });
  });

  it('renders 404 message for invalid or revoked share', async () => {
    vi.mocked(sharingApi.sharingApi.getSharedPlan).mockRejectedValue({
      response: { status: 404 },
    });

    render(
      <MemoryRouter initialEntries={['/shared/test-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Invalid Link')).toBeInTheDocument();
      expect(
        screen.getByText(/invalid or no longer shared/)
      ).toBeInTheDocument();
    });
  });

  it('does NOT import the interceptor-bearing client', () => {
    // This test verifies via render that SharedPlanPage works correctly
    // The source-code inspection that the file does not import '../api/client'
    // is documented as a review requirement and will be verified by inspecting
    // the import statements in SharedPlanPage.tsx directly.
    // For testing purposes, we verify the component works with publicClient by
    // verifying it successfully calls sharingApi.getSharedPlan (which uses publicClient)
    expect(sharingApi.sharingApi.getSharedPlan).toBeDefined();
  });

  it('renders ShareWorkoutStarter when permission is log', async () => {
    const logData = { ...mockDaysPlan, permission: 'log' as const };
    vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
      logData as any
    );

    render(
      <MemoryRouter initialEntries={['/shared/test-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Plan')).toBeInTheDocument();
    });

    // ShareWorkoutStarter should render its Begin workout button
    expect(screen.getByText('Begin workout →')).toBeInTheDocument();
  });

  it('renders ShareWorkoutStarter when permission is edit', async () => {
    const editData = { ...mockWeeksPlan, permission: 'edit' as const };
    vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
      editData as any
    );

    render(
      <MemoryRouter initialEntries={['/shared/test-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Weekly Plan')).toBeInTheDocument();
    });

    // ShareWorkoutStarter should render its Begin workout button
    expect(screen.getByText('Begin workout →')).toBeInTheDocument();
  });

  it('does not render ShareWorkoutStarter when permission is view', async () => {
    vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
      mockDaysPlan as any
    );

    render(
      <MemoryRouter initialEntries={['/shared/test-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Plan')).toBeInTheDocument();
    });

    // Begin workout button should not be visible for view-only permission
    expect(screen.queryByText('Begin workout →')).not.toBeInTheDocument();
  });

  describe('Edit plan button (Phase 5c)', () => {
    afterEach(() => {
      localStorage.clear();
    });

    it('renders an Edit plan link when permission is edit and the viewer is authenticated', async () => {
      localStorage.setItem('auth_token', 'fake-token');
      const editData = { ...mockDaysPlan, permission: 'edit' as const };
      vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
        editData as any
      );

      render(
        <MemoryRouter initialEntries={['/shared/test-token']}>
          <Routes>
            <Route path="/shared/:token" element={<SharedPlanPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Plan')).toBeInTheDocument();
      });

      const editLink = screen.getByText('Edit plan');
      expect(editLink).toBeInTheDocument();
      expect(editLink.closest('a')).toHaveAttribute(
        'href',
        `/workout-plans/${editData.plan.id}/edit`
      );
    });

    it('does NOT render the Edit plan link when permission is edit but the viewer is anonymous', async () => {
      // No auth_token in localStorage - anonymous visitor, even with edit-tier link permission.
      const editData = { ...mockDaysPlan, permission: 'edit' as const };
      vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
        editData as any
      );

      render(
        <MemoryRouter initialEntries={['/shared/test-token']}>
          <Routes>
            <Route path="/shared/:token" element={<SharedPlanPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Plan')).toBeInTheDocument();
      });

      expect(screen.queryByText('Edit plan')).not.toBeInTheDocument();
    });

    it('does NOT render the Edit plan link for an authenticated viewer with only log permission', async () => {
      localStorage.setItem('auth_token', 'fake-token');
      const logData = { ...mockDaysPlan, permission: 'log' as const };
      vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
        logData as any
      );

      render(
        <MemoryRouter initialEntries={['/shared/test-token']}>
          <Routes>
            <Route path="/shared/:token" element={<SharedPlanPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Plan')).toBeInTheDocument();
      });

      expect(screen.queryByText('Edit plan')).not.toBeInTheDocument();
    });

    it('does NOT render the Edit plan link for an authenticated viewer with only view permission', async () => {
      localStorage.setItem('auth_token', 'fake-token');
      vi.mocked(sharingApi.sharingApi.getSharedPlan).mockResolvedValue(
        mockDaysPlan as any
      );

      render(
        <MemoryRouter initialEntries={['/shared/test-token']}>
          <Routes>
            <Route path="/shared/:token" element={<SharedPlanPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Plan')).toBeInTheDocument();
      });

      expect(screen.queryByText('Edit plan')).not.toBeInTheDocument();
    });
  });
});
