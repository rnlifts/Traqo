import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { sharingApi } from '../../api/sharingApi';
import type { WorkoutShare, ShareGrant } from '../../api/sharingApi';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planId: number;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  planId,
}) => {
  const [loading, setLoading] = useState(false);
  const [share, setShare] = useState<WorkoutShare | null>(null);
  const [shareExists, setShareExists] = useState(false);
  const [grants, setGrants] = useState<ShareGrant[]>([]);
  const [username, setUsername] = useState('');
  const [permission, setPermission] = useState<'view' | 'log' | 'edit'>('view');
  const [grantError, setGrantError] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const { Toast, showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadShare();
    }
  }, [isOpen]);

  async function loadShare() {
    setLoading(true);
    try {
      const data = await sharingApi.getShare(planId);
      if (data.revoked_at) {
        // The share row exists but was revoked (e.g. via "Stop sharing"). Treat it
        // the same as "no share yet" so the dialog offers "Create share link" —
        // that button calls the same create-or-unrevoke endpoint, which correctly
        // un-revokes this row (preserving its token) rather than leaving the owner
        // stuck editing a config that silently never takes effect.
        setShareExists(false);
        setShare(null);
        setGrants([]);
      } else {
        setShare(data);
        setShareExists(true);
        setGrants(data.grants);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setShareExists(false);
        setShare(null);
        setGrants([]);
      } else {
        console.error('Error loading share:', err);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShare() {
    setLoading(true);
    try {
      const data = await sharingApi.createShare(planId);
      setShare(data);
      setShareExists(true);
      setGrants(data.grants);
    } catch (err: any) {
      console.error('Error creating share:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleModeChange(newMode: 'restricted' | 'anyone') {
    if (!share) return;
    try {
      const updated = await sharingApi.updateShare(planId, { mode: newMode });
      setShare(updated);
    } catch (err: any) {
      console.error('Error updating mode:', err);
    }
  }

  async function handlePermissionChange(newPermission: 'view' | 'log' | 'edit') {
    if (!share) return;
    try {
      const updated = await sharingApi.updateShare(planId, {
        link_permission: newPermission,
      });
      setShare(updated);
    } catch (err: any) {
      console.error('Error updating permission:', err);
    }
  }

  async function handleCopyLink() {
    if (!share) return;
    const url = `${window.location.origin}/shared/${share.token}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied', 'success');
    } catch (err) {
      showToast('Failed to copy link', 'error');
    }
  }

  async function handleGrantAccess() {
    if (!username.trim()) {
      setGrantError('Username is required');
      return;
    }
    setGrantError('');
    try {
      const newGrant = await sharingApi.grantAccess(planId, username, permission);
      setGrants([...grants, newGrant]);
      setUsername('');
      setPermission('view');
    } catch (err: any) {
      if (err.response?.status === 404) {
        setGrantError('User not found');
      } else {
        setGrantError('Failed to grant access');
      }
    }
  }

  async function handleRemoveGrant(grantUsername: string) {
    try {
      await sharingApi.revokeAccess(planId, grantUsername);
      setGrants(grants.filter((g) => g.username !== grantUsername));
    } catch (err: any) {
      console.error('Error removing grant:', err);
    }
  }

  async function handleRevokeShare() {
    setConfirmRevoke(false);
    try {
      await sharingApi.revokeShare(planId);
      setShare(null);
      setShareExists(false);
      setGrants([]);
    } catch (err: any) {
      console.error('Error revoking share:', err);
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Share Plan">
        {loading && <div className="loading">Loading...</div>}

        {!loading && !shareExists && (
          <div style={{ textAlign: 'center' }}>
            <p>Create a share link to share this plan with others.</p>
            <button
              onClick={handleCreateShare}
              className="btn-primary"
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Create share link
            </button>
          </div>
        )}

        {!loading && shareExists && share && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Copy Link */}
            <div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/shared/${share.token}`}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                />
                <button
                  onClick={handleCopyLink}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Mode Toggle */}
            <div>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                Who can access?
              </label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="radio"
                    name="mode"
                    value="restricted"
                    checked={share.mode === 'restricted'}
                    onChange={() => handleModeChange('restricted')}
                  />
                  Restricted (only invited users)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="radio"
                    name="mode"
                    value="anyone"
                    checked={share.mode === 'anyone'}
                    onChange={() => handleModeChange('anyone')}
                  />
                  Anyone with the link
                </label>
              </div>
            </div>

            {/* Link Permission (shown only for 'anyone' mode) */}
            {share.mode === 'anyone' && (
              <div>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                  Permission level
                </label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  {(['view', 'log', 'edit'] as const).map((perm) => (
                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        name="link_permission"
                        value={perm}
                        checked={share.link_permission === perm}
                        onChange={() => handlePermissionChange(perm)}
                      />
                      {perm.charAt(0).toUpperCase() + perm.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Grant Access Section */}
            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-hover)',
                borderRadius: '4px',
              }}
            >
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                Grant access to a user
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setGrantError('');
                  }}
                  style={{
                    flex: '1 1 auto',
                    minWidth: '150px',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                  }}
                />
                <select
                  value={permission}
                  onChange={(e) =>
                    setPermission(e.target.value as 'view' | 'log' | 'edit')
                  }
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                  }}
                >
                  <option value="view">View</option>
                  <option value="log">Log</option>
                  <option value="edit">Edit</option>
                </select>
                <button
                  onClick={handleGrantAccess}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Share
                </button>
              </div>
              {grantError && (
                <div
                  style={{
                    color: '#dc3545',
                    fontSize: '12px',
                    marginBottom: '10px',
                  }}
                >
                  {grantError}
                </div>
              )}
            </div>

            {/* Grants List */}
            {grants.length > 0 && (
              <div>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                  Shared with
                </label>
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  {grants.map((grant) => (
                    <div
                      key={grant.username}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600' }}>{grant.display_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          @{grant.username} • {grant.permission}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveGrant(grant.username)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stop Sharing */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmRevoke(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Stop sharing
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmRevoke}
        title="Stop Sharing"
        message="Are you sure you want to revoke this share link? Anyone with the link will no longer be able to access this plan."
        confirmText="Stop sharing"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={handleRevokeShare}
        onCancel={() => setConfirmRevoke(false)}
      />

      {Toast}
    </>
  );
};
