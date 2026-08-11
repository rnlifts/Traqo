import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';
import type { UserProfile } from '../api/authApi';
import { en } from '../i18n/en';

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: en, setLanguage: vi.fn() }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: vi.fn() };
});

const incompleteProfile: UserProfile = {
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

const completeProfile: UserProfile = {
  ...incompleteProfile,
  age: 25,
  weight_kg: 70,
  height_cm: 175,
  gender: 'male',
  activity_level: 'moderate',
  is_complete: true,
  body_metrics: { bmi: 22.9, bmr: 1673.8, maintenance_calories: 2594 },
};

describe('ProfileCard', () => {
  let mockNavigate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  const renderComponent = (profile: UserProfile) =>
    render(
      <BrowserRouter>
        <ProfileCard profile={profile} />
      </BrowserRouter>
    );

  it('shows a "Complete Profile" prompt and button when incomplete', () => {
    renderComponent(incompleteProfile);

    expect(screen.getByText(/Complete your profile/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete Profile/i })).toBeInTheDocument();
  });

  it('shows the profile fields and an "Edit" button when complete', () => {
    renderComponent(completeProfile);

    expect(screen.getByText('25 years')).toBeInTheDocument();
    expect(screen.getByText('70 kg')).toBeInTheDocument();
    expect(screen.getByText('175 cm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Edit$/i })).toBeInTheDocument();
  });

  it('the edit/complete button always navigates to /profile', async () => {
    const user = userEvent.setup();
    renderComponent(completeProfile);

    await user.click(screen.getByRole('button', { name: /^Edit$/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/profile', { state: { autoEdit: true } });
  });

  it('shows the display name initial as an avatar', () => {
    renderComponent(completeProfile);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Aryan')).toBeInTheDocument();
    expect(screen.getByText('@aryanlifts')).toBeInTheDocument();
  });
});
