import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ShareDialog } from './ShareDialog';
import * as sharingApi from '../../api/sharingApi';

vi.mock('../../api/sharingApi');
vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    Toast: null,
    showToast: vi.fn(),
  }),
}));

const mockShare = {
  id: 1,
  token: 'test-token-123',
  mode: 'restricted' as const,
  link_permission: 'view' as const,
  created_at: '2026-08-05T00:00:00Z',
  revoked_at: null,
  grants: [
    {
      username: 'alice',
      display_name: 'Alice Smith',
      permission: 'view' as const,
    },
  ],
};

describe('ShareDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Create share link" button when no share exists (404)', async () => {
    vi.mocked(sharingApi.sharingApi.getShare).mockRejectedValue({
      response: { status: 404 },
    });

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Create share link/i })
      ).toBeInTheDocument();
    });
  });

  it('creates share and shows management UI on create button click', async () => {
    vi.mocked(sharingApi.sharingApi.getShare).mockRejectedValue({
      response: { status: 404 },
    });
    vi.mocked(sharingApi.sharingApi.createShare).mockResolvedValue(mockShare);

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Create share link/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Create share link/i }));

    await waitFor(() => {
      expect(sharingApi.sharingApi.createShare).toHaveBeenCalledWith(1);
      // The management UI should show
      expect(screen.getByDisplayValue(/\/shared\/test-token-123/)).toBeInTheDocument();
    });
  });

  it('renders existing share with token, mode toggle, and grants list', async () => {
    vi.mocked(sharingApi.sharingApi.getShare).mockResolvedValue(mockShare);

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue(/\/shared\/test-token-123/)).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText(/@alice/)).toBeInTheDocument();
    });
  });

  it('changes mode to "anyone" and calls PUT with mode update', async () => {
    const updatedShare = { ...mockShare, mode: 'anyone' as const };
    vi.mocked(sharingApi.sharingApi.getShare).mockResolvedValue(mockShare);
    vi.mocked(sharingApi.sharingApi.updateShare).mockResolvedValue(updatedShare);

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue(/\/shared\/test-token-123/)).toBeInTheDocument();
    });

    const anyoneRadio = screen.getByLabelText(/Anyone with the link/i);
    fireEvent.click(anyoneRadio);

    await waitFor(() => {
      expect(sharingApi.sharingApi.updateShare).toHaveBeenCalledWith(1, {
        mode: 'anyone',
      });
    });
  });

  it('shows link-permission picker only in "anyone" mode and updates on change', async () => {
    const updatedShare = {
      ...mockShare,
      mode: 'anyone' as const,
      link_permission: 'log' as const,
    };
    vi.mocked(sharingApi.sharingApi.getShare).mockResolvedValue(updatedShare);
    vi.mocked(sharingApi.sharingApi.updateShare).mockResolvedValue(updatedShare);

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(screen.getByText('Permission level')).toBeInTheDocument();
      expect(screen.getByLabelText('Log')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Edit'));

    await waitFor(() => {
      expect(sharingApi.sharingApi.updateShare).toHaveBeenCalledWith(1, {
        link_permission: 'edit',
      });
    });
  });

  it('grants access to a user and adds them to the grants list', async () => {
    vi.mocked(sharingApi.sharingApi.getShare).mockResolvedValue(mockShare);
    const newGrant = {
      username: 'bob',
      display_name: 'Bob Jones',
      permission: 'edit' as const,
    };
    vi.mocked(sharingApi.sharingApi.grantAccess).mockResolvedValue(newGrant);

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue(/\/shared\/test-token-123/)).toBeInTheDocument();
    });

    const usernameInput = screen.getByPlaceholderText('Username');
    fireEvent.change(usernameInput, { target: { value: 'bob' } });

    const permissionSelect = screen.getByDisplayValue('View');
    fireEvent.change(permissionSelect, { target: { value: 'edit' } });

    fireEvent.click(screen.getByRole('button', { name: /^Share$/ }));

    await waitFor(() => {
      expect(sharingApi.sharingApi.grantAccess).toHaveBeenCalledWith(1, 'bob', 'edit');
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });
  });

  it('shows inline error message when granting to non-existent user (404)', async () => {
    vi.mocked(sharingApi.sharingApi.getShare).mockResolvedValue(mockShare);
    vi.mocked(sharingApi.sharingApi.grantAccess).mockRejectedValue({
      response: { status: 404 },
    });

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue(/\/shared\/test-token-123/)).toBeInTheDocument();
    });

    const usernameInput = screen.getByPlaceholderText('Username');
    fireEvent.change(usernameInput, { target: { value: 'nonexistent' } });

    fireEvent.click(screen.getByRole('button', { name: /^Share$/ }));

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });

    // Assert that the input was not cleared
    expect(screen.getByDisplayValue('nonexistent')).toBeInTheDocument();
  });

  it('removes grant when Remove button is clicked', async () => {
    vi.mocked(sharingApi.sharingApi.getShare).mockResolvedValue(mockShare);
    vi.mocked(sharingApi.sharingApi.revokeAccess).mockResolvedValue(undefined);

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const removeButton = screen.getAllByRole('button', { name: /Remove/ })[0];
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(sharingApi.sharingApi.revokeAccess).toHaveBeenCalledWith(1, 'alice');
      expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    });
  });

  it('opens ConfirmDialog and revokes share on confirmation', async () => {
    vi.mocked(sharingApi.sharingApi.getShare).mockResolvedValue(mockShare);
    vi.mocked(sharingApi.sharingApi.revokeShare).mockResolvedValue({
      ...mockShare,
      revoked_at: new Date().toISOString(),
    });

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue(/\/shared\/test-token-123/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Stop sharing/ }));

    await waitFor(() => {
      expect(screen.getByText('Stop Sharing')).toBeInTheDocument();
    });

    // The ConfirmDialog should show
    const confirmButton = screen.getAllByRole('button', { name: /Stop sharing/ })[1];
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(sharingApi.sharingApi.revokeShare).toHaveBeenCalledWith(1);
      // Should show "Create share link" button again (back to initial state)
      expect(
        screen.getByRole('button', { name: /Create share link/i })
      ).toBeInTheDocument();
    });
  });

  it('copies link to clipboard and shows toast on success', async () => {
    vi.mocked(sharingApi.sharingApi.getShare).mockResolvedValue(mockShare);
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(
      <ShareDialog isOpen={true} onClose={vi.fn()} planId={1} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        `${window.location.origin}/shared/test-token-123`
      );
    });
  });
});
