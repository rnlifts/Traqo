import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { sharingApi } from '../../api/sharingApi';
import type { WorkoutShare, ShareGrant } from '../../api/sharingApi';
import { useLanguage } from '../../contexts/LanguageContext';

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
  const { t } = useLanguage();

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
      // A public "anyone" link may only ever grant view access - reset
      // link_permission in the same request so switching to "anyone" never
      // gets rejected just because a log/edit tier was set previously.
      const updates =
        newMode === 'anyone'
          ? { mode: newMode, link_permission: 'view' as const }
          : { mode: newMode };
      const updated = await sharingApi.updateShare(planId, updates);
      setShare(updated);
    } catch (err: any) {
      console.error('Error updating mode:', err);
    }
  }

  async function handleCopyLink() {
    if (!share) return;
    const url = `${window.location.origin}/shared/${share.token}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t.sharing.linkCopied, 'success');
    } catch (err) {
      showToast(t.sharing.copyLinkFailed, 'error');
    }
  }

  async function handleGrantAccess() {
    if (!username.trim()) {
      setGrantError(t.sharing.usernameRequired);
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
        setGrantError(t.sharing.userNotFound);
      } else {
        setGrantError(t.sharing.grantFailed);
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
      <Modal isOpen={isOpen} onClose={onClose} title={t.sharing.modalTitle}>
        {loading && <div className="loading">{t.sharing.loading}</div>}

        {!loading && !shareExists && (
          <div style={{ textAlign: 'center' }}>
            <p>{t.sharing.createPrompt}</p>
            <button
              onClick={handleCreateShare}
              className="btn-primary"
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {t.sharing.createLink}
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
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {t.sharing.copy}
                </button>
              </div>
            </div>

            {/* Mode Toggle */}
            <div>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                {t.sharing.whoCanAccess}
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
                  {t.sharing.restricted}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="radio"
                    name="mode"
                    value="anyone"
                    checked={share.mode === 'anyone'}
                    onChange={() => handleModeChange('anyone')}
                  />
                  {t.sharing.anyoneWithLink}
                </label>
              </div>
            </div>

            {/* A public "anyone" link only ever grants view access - no picker needed.
                For log/edit, the owner grants a specific username below instead. */}
            {share.mode === 'anyone' && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-hover)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                }}
              >
                {t.sharing.anyoneNoticeBefore}<strong>{t.sharing.anyoneNoticeViewWord}</strong>{t.sharing.anyoneNoticeAfter}
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
                {t.sharing.grantAccessTo}
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder={t.sharing.usernamePlaceholder}
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
                  <option value="view">{t.sharing.viewOption}</option>
                  <option value="log">{t.sharing.logOption}</option>
                  <option value="edit">{t.sharing.editOption}</option>
                </select>
                <button
                  onClick={handleGrantAccess}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--success)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {t.planList.share}
                </button>
              </div>
              {grantError && (
                <div
                  style={{
                    color: 'var(--danger)',
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
                  {t.sharing.sharedWith}
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
                          backgroundColor: 'var(--danger)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        {t.sharing.remove}
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
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                {t.sharing.stopSharing}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmRevoke}
        title={t.sharing.stopSharingTitle}
        message={t.sharing.revokeMessage}
        confirmText={t.sharing.stopSharing}
        cancelText={t.planBuilder.cancel}
        isDangerous={true}
        onConfirm={handleRevokeShare}
        onCancel={() => setConfirmRevoke(false)}
      />

      {Toast}
    </>
  );
};
