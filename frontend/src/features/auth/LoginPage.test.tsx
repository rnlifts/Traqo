import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { LanguageProvider } from '../../contexts/LanguageContext';

vi.mock('../../api/authApi', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <LanguageProvider>
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      </LanguageProvider>
    );
  };

  async function submitLogin(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Username:'), 'aaryanlifts');
    await user.type(screen.getByLabelText('Password:'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Login' }));
  }

  describe('account lockout (429)', () => {
    it('shows a real countdown when the server sends a valid Retry-After header', async () => {
      const user = userEvent.setup();
      const { authApi } = await import('../../api/authApi');
      (authApi.login as any).mockRejectedValue({
        response: { status: 429, headers: { 'retry-after': '125' }, data: {} },
      });

      renderComponent();
      await submitLogin(user);

      // 125s -> 2:05
      await waitFor(() => expect(screen.getByText('Locked (2:05)')).toBeInTheDocument());
    });

    it('falls back to a sane default instead of "NaN:NaN" when Retry-After is missing', async () => {
      // Regression test for the production bug: the account-lockout 429 didn't
      // carry a Retry-After header (a global exception handler was dropping
      // it), so parseInt(undefined) produced NaN and the button showed
      // "Locked (NaN:NaN)".
      const user = userEvent.setup();
      const { authApi } = await import('../../api/authApi');
      (authApi.login as any).mockRejectedValue({
        response: { status: 429, headers: {}, data: {} },
      });

      renderComponent();
      await submitLogin(user);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Locked/ });
        expect(button.textContent).not.toMatch(/NaN/);
        expect(button.textContent).toBe('Locked (15:00)');
      });
    });

    it('shows the generic error message for a non-lockout failure', async () => {
      const user = userEvent.setup();
      const { authApi } = await import('../../api/authApi');
      (authApi.login as any).mockRejectedValue({
        response: { status: 401, data: { error: 'Invalid username or password' } },
      });

      renderComponent();
      await submitLogin(user);

      expect(await screen.findByText('Invalid username or password')).toBeInTheDocument();
      expect(screen.queryByText(/Locked/)).not.toBeInTheDocument();
    });
  });
});
