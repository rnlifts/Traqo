import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';

vi.mock('../../api/authApi', () => ({
  authApi: {
    checkUsernameAvailability: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock('./RegistrationSuccessDialog', () => ({
  RegistrationSuccessDialog: () => <div data-testid="success-dialog">Success Dialog</div>,
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );
  };

  describe('username format validation', () => {
    it('shows error for username shorter than 3 characters', async () => {
      const user = userEvent.setup();
      renderComponent();

      const usernameInput = screen.getByLabelText('Username:');
      await user.type(usernameInput, 'ab');

      await waitFor(() => {
        expect(screen.getByText('Must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('shows error for username longer than 20 characters', async () => {
      const user = userEvent.setup();
      renderComponent();

      const usernameInput = screen.getByLabelText('Username:');
      await user.type(usernameInput, 'abcdefghijklmnopqrstu');

      await waitFor(() => {
        expect(screen.getByText('Must be at most 20 characters')).toBeInTheDocument();
      });
    });

    it('shows error if username does not start with a letter', async () => {
      const user = userEvent.setup();
      renderComponent();

      const usernameInput = screen.getByLabelText('Username:');
      await user.type(usernameInput, '_invalid');

      await waitFor(() => {
        expect(screen.getByText('Must start with a letter')).toBeInTheDocument();
      });
    });

    it('shows error for invalid characters', async () => {
      const user = userEvent.setup();
      renderComponent();

      const usernameInput = screen.getByLabelText('Username:');
      await user.type(usernameInput, 'invalid-name');

      await waitFor(() => {
        expect(screen.getByText('Only lowercase letters, numbers, and underscores allowed')).toBeInTheDocument();
      });
    });
  });

  describe('username availability check', () => {
    it('debounces availability check for valid username', async () => {
      const user = userEvent.setup({ delay: null }); // Disable delay to speed up test
      const { authApi } = await import('../../api/authApi');
      (authApi.checkUsernameAvailability as any).mockResolvedValue({ available: true });

      renderComponent();

      const usernameInput = screen.getByLabelText('Username:');
      await user.type(usernameInput, 'validuser');

      // Wait for debounce + check to complete
      await waitFor(() => {
        expect(screen.getByText('✓ Username available')).toBeInTheDocument();
      });

      // Should only have been called once (debounced)
      expect(authApi.checkUsernameAvailability).toHaveBeenCalledTimes(1);
      expect(authApi.checkUsernameAvailability).toHaveBeenCalledWith('validuser');
    });

    it('shows "taken" status when username is not available', async () => {
      const user = userEvent.setup({ delay: null });
      const { authApi } = await import('../../api/authApi');
      (authApi.checkUsernameAvailability as any).mockResolvedValue({ available: false, reason: 'Username already taken' });

      renderComponent();

      const usernameInput = screen.getByLabelText('Username:');
      await user.type(usernameInput, 'taken_user');

      await waitFor(() => {
        expect(screen.getByText('✗ Username already taken')).toBeInTheDocument();
      });
    });
  });

  describe('Register button state', () => {
    it('disables Register button when username is not available', async () => {
      const user = userEvent.setup({ delay: null });
      const { authApi } = await import('../../api/authApi');
      (authApi.checkUsernameAvailability as any).mockResolvedValue({ available: false });

      renderComponent();

      const displayNameInput = screen.getByLabelText('Nickname:');
      const usernameInput = screen.getByLabelText('Username:');
      const passwordInput = screen.getByLabelText('Password:');
      const registerButton = screen.getByRole('button', { name: /Register/i });

      await user.type(displayNameInput, 'John');
      await user.type(usernameInput, 'taken_user');
      await user.type(passwordInput, 'password123');

      await waitFor(() => {
        expect(registerButton).toBeDisabled();
      });
    });

    it('enables Register button when all fields are valid', async () => {
      const user = userEvent.setup({ delay: null });
      const { authApi } = await import('../../api/authApi');
      (authApi.checkUsernameAvailability as any).mockResolvedValue({ available: true });

      renderComponent();

      const displayNameInput = screen.getByLabelText('Nickname:');
      const usernameInput = screen.getByLabelText('Username:');
      const passwordInput = screen.getByLabelText('Password:');
      const registerButton = screen.getByRole('button', { name: /Register/i });

      await user.type(displayNameInput, 'John');
      await user.type(usernameInput, 'validuser');
      await user.type(passwordInput, 'password123');

      await waitFor(() => {
        expect(registerButton).not.toBeDisabled();
      });
    });

    it('disables Register button when display name is empty', async () => {
      const user = userEvent.setup({ delay: null });
      const { authApi } = await import('../../api/authApi');
      (authApi.checkUsernameAvailability as any).mockResolvedValue({ available: true });

      renderComponent();

      const usernameInput = screen.getByLabelText('Username:');
      const passwordInput = screen.getByLabelText('Password:');
      const registerButton = screen.getByRole('button', { name: /Register/i });

      await user.type(usernameInput, 'validuser');
      await user.type(passwordInput, 'password123');

      await waitFor(() => {
        expect(registerButton).toBeDisabled();
      });
    });
  });
});
