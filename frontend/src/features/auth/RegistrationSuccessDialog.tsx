import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';

interface RegistrationSuccessDialogProps {
  username: string;
  password: string;
}

export const RegistrationSuccessDialog: React.FC<RegistrationSuccessDialogProps> = ({
  username,
  password,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [copyButtonText, setCopyButtonText] = useState(t.registrationSuccess.copyUsername);
  const [copyConfirmation, setCopyConfirmation] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleCopyUsername = async () => {
    try {
      await navigator.clipboard.writeText(`@${username}`);
      setCopyButtonText(t.registrationSuccess.copied);
      setCopyConfirmation(t.registrationSuccess.copiedConfirmation);
      setTimeout(() => {
        setCopyButtonText(t.registrationSuccess.copyUsername);
        setCopyConfirmation('');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyButtonText(t.registrationSuccess.copyFailed);
      setTimeout(() => setCopyButtonText(t.registrationSuccess.copyUsername), 2000);
    }
  };

  const handleDownloadCredentials = () => {
    setIsDownloading(true);
    try {
      const fileContent = `${t.registrationSuccess.downloadFileHeader}\n\n${t.registrationSuccess.downloadFileBody(username)}`;

      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'traqo-login-credentials.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleContinueToLogin = () => {
    const message = `${t.login.prefilledBefore}${t.login.submit}${t.login.prefilledAfter}`;
    navigate('/login', { state: { username, password, message } });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '8px',
          padding: '40px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: 'bold', color: 'var(--text-h)' }}>
            {t.registrationSuccess.title}
          </h2>
        </div>

        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            {t.registrationSuccess.usernameLabel}
          </p>
          <div
            style={{
              backgroundColor: 'var(--accent)',
              borderRadius: '12px',
              padding: '16px 20px',
              fontFamily: 'monospace',
              fontSize: '18px',
              color: 'white',
              fontWeight: '600',
              textAlign: 'center',
              wordBreak: 'break-all',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            @{username}
          </div>
          {copyConfirmation && (
            <div style={{ fontSize: '13px', color: 'var(--success)', marginTop: '8px', fontWeight: '500' }}>
              {copyConfirmation}
            </div>
          )}
        </div>

        <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: '1.6', marginBottom: '24px', margin: '0 0 24px 0' }}>
          {t.registrationSuccess.needUsername}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={handleCopyUsername}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-h)',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
          >
            {copyButtonText}
          </button>

          <button
            onClick={handleDownloadCredentials}
            disabled={isDownloading}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-h)',
              cursor: isDownloading ? 'not-allowed' : 'pointer',
              opacity: isDownloading ? 0.6 : 1,
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => !isDownloading && (e.currentTarget.style.backgroundColor = 'var(--border)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
          >
            {isDownloading ? t.registrationSuccess.downloading : t.registrationSuccess.downloadDetails}
          </button>

          <button
            onClick={handleContinueToLogin}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: 'var(--accent)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              marginTop: '8px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
          >
            {t.registrationSuccess.continueToLogin}
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.7, lineHeight: '1.5', marginBottom: 0 }}>
          {t.registrationSuccess.keepSafe}
        </p>
      </div>
    </div>
  );
};
