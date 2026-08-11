import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import { en } from '../i18n/en';

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../components/Toast', () => ({
  useToast: vi.fn(() => ({ Toast: null, showToast: vi.fn() })),
}));

vi.mock('../api/authApi', () => ({
  authApi: {
    getMe: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

const incompleteProfile = {
  username: 'aryanlifts',
  display_name: 'Aryan',
  age: null,
  weight_kg: null,
  height_cm: null,
  gender: null,
  activity_level: null,
  is_complete: false,
  body_metrics: null,
};

const completeProfile = {
  username: 'aryanlifts',
  display_name: 'Aryan',
  age: 25,
  weight_kg: 70,
  height_cm: 175,
  gender: 'male',
  activity_level: 'moderate',
  is_complete: true,
  body_metrics: { bmi: 22.9, bmr: 1673.8, maintenance_calories: 2594 },
};

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );

  it('shows a "Complete Profile" prompt for an incomplete profile', async () => {
    const { authApi } = await import('../api/authApi');
    (authApi.getMe as any).mockResolvedValue(incompleteProfile);

    renderPage();

    await screen.findByText(/Complete your profile/);
    expect(screen.getByRole('button', { name: /Complete Profile/i })).toBeInTheDocument();
  });

  it('shows profile fields and computed body stats for a complete profile', async () => {
    const { authApi } = await import('../api/authApi');
    (authApi.getMe as any).mockResolvedValue(completeProfile);

    renderPage();

    await screen.findByText('25 years');
    expect(screen.getByText('70 kg')).toBeInTheDocument();
    expect(screen.getByText('175 cm')).toBeInTheDocument();
    expect(screen.getByText('Body stats')).toBeInTheDocument();
    expect(screen.getByText('22.9')).toBeInTheDocument();
  });

  it('shows an error state with retry if loading fails', async () => {
    const { authApi } = await import('../api/authApi');
    (authApi.getMe as any).mockRejectedValue(new Error('network error'));

    renderPage();

    await screen.findByText('Something Went Wrong');
  });

  it('entering edit mode pre-fills the form with existing values', async () => {
    const user = userEvent.setup();
    const { authApi } = await import('../api/authApi');
    (authApi.getMe as any).mockResolvedValue(completeProfile);

    renderPage();

    const editButton = await screen.findByRole('button', { name: /^Edit$/i });
    await user.click(editButton);

    expect(screen.getByDisplayValue('25')).toBeInTheDocument(); // age
    expect(screen.getByDisplayValue('70')).toBeInTheDocument(); // weight
  });

  it('saving converts a weight entered in lbs to canonical kg before submitting', async () => {
    const user = userEvent.setup();
    const { authApi } = await import('../api/authApi');
    (authApi.getMe as any).mockResolvedValue(incompleteProfile);
    (authApi.updateProfile as any).mockResolvedValue(completeProfile);

    renderPage();
    await user.click(await screen.findByRole('button', { name: /Complete Profile/i }));

    await user.type(screen.getByLabelText('Age'), '25');
    await user.selectOptions(screen.getByLabelText('Weight unit'), 'lbs');
    await user.type(screen.getByLabelText('Weight'), '154.3');
    await user.type(screen.getByLabelText('Height'), '175');
    await user.selectOptions(screen.getByLabelText('Gender'), 'male');
    await user.selectOptions(screen.getByLabelText('Activity level'), 'moderate');

    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(authApi.updateProfile).toHaveBeenCalled();
    });
    const call = (authApi.updateProfile as any).mock.calls[0][0];
    expect(call.age).toBe(25);
    expect(call.weight_kg).toBeCloseTo(70, 1); // 154.3 lbs -> ~70 kg
    expect(call.height_cm).toBe(175);
    expect(call.gender).toBe('male');
    expect(call.activity_level).toBe('moderate');
  });

  it('saving converts height entered in ft/in to canonical cm before submitting', async () => {
    const user = userEvent.setup();
    const { authApi } = await import('../api/authApi');
    (authApi.getMe as any).mockResolvedValue(incompleteProfile);
    (authApi.updateProfile as any).mockResolvedValue(completeProfile);

    renderPage();
    await user.click(await screen.findByRole('button', { name: /Complete Profile/i }));

    await user.type(screen.getByLabelText('Age'), '25');
    await user.type(screen.getByLabelText('Weight'), '70');
    await user.selectOptions(screen.getByLabelText('Height unit'), 'ftin');
    await user.type(screen.getByLabelText('Height (feet)'), '5');
    await user.type(screen.getByLabelText('Height (inches)'), '9');
    await user.selectOptions(screen.getByLabelText('Gender'), 'male');
    await user.selectOptions(screen.getByLabelText('Activity level'), 'moderate');

    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      const call = (authApi.updateProfile as any).mock.calls[0][0];
      expect(call.height_cm).toBeCloseTo(175, 0); // 5'9" -> ~175cm
    });
  });

  it('shows an error toast and does not clear the form when saving fails', async () => {
    const user = userEvent.setup();
    const { authApi } = await import('../api/authApi');
    const { useToast } = await import('../components/Toast');
    const showToast = vi.fn();
    (useToast as any).mockReturnValue({ Toast: null, showToast });
    (authApi.getMe as any).mockResolvedValue(completeProfile);
    (authApi.updateProfile as any).mockRejectedValue({ response: { data: { detail: 'Invalid gender' } } });

    renderPage();
    await user.click(await screen.findByRole('button', { name: /^Edit$/i }));
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Invalid gender', 'error');
    });
    // Still in editing mode — the form wasn't dismissed on failure.
    expect(screen.getByRole('button', { name: /^Save$/i })).toBeInTheDocument();
  });

  it('opens directly into edit mode when navigated to with autoEdit state (e.g. from the dashboard "Complete Profile" button)', async () => {
    const { authApi } = await import('../api/authApi');
    (authApi.getMe as any).mockResolvedValue(incompleteProfile);

    render(
      <MemoryRouter initialEntries={[{ pathname: '/profile', state: { autoEdit: true } }]}>
        <ProfilePage />
      </MemoryRouter>
    );

    // The edit form (Save/Cancel) is visible immediately — no need to click
    // "Complete Profile" a second time after already clicking it once to get here.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Save$/i })).toBeInTheDocument();
    });
  });
});
