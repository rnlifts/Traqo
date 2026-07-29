import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workoutSessionsApi } from '../api/workoutSessionsApi';
import { useToast } from './Toast';
import { ClipboardIcon, DumbbellIcon, ArrowRightIcon } from './icons';

export const PlanActionCards: React.FC = () => {
  const navigate = useNavigate();
  const { Toast, showToast } = useToast();
  const [quickStarting, setQuickStarting] = useState(false);

  const handleQuickStart = async () => {
    setQuickStarting(true);
    try {
      const response = await workoutSessionsApi.quickStart();
      navigate(`/workout-sessions/${response.session_id}`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast('Finish or discard your unresolved workout before starting a new one', 'error');
        navigate('/dashboard');
        return;
      }
      const errorMsg =
        err.response?.data?.error || (err as Error).message || 'Failed to start quick workout';
      showToast(errorMsg, 'error');
      setQuickStarting(false);
    }
  };

  const cardStyle = {
    padding: '20px',
    borderRadius: '12px',
    border: '2px dashed var(--border)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    flex: 1,
  };

  const iconContainerStyle = {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <>
      <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '16px', marginTop: '24px' }}>
        What would you like to do today?
      </h2>

      <div className="plan-action-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Plan Everything Upfront */}
        <div
          style={{
            ...cardStyle,
            borderColor: 'var(--accent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ ...iconContainerStyle, backgroundColor: 'var(--accent-soft)' }}>
              <ClipboardIcon size={24} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: 'var(--text-h)' }}>
                Plan Everything Upfront
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: '1.4' }}>
                Create your complete workout routine before you start training.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/workout-plans/new')}
            style={{
              marginTop: 'auto',
              padding: '12px 16px',
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent)';
            }}
          >
            Create Plan
            <ArrowRightIcon size={16} />
          </button>
        </div>

        {/* Start Small. Build Over Time */}
        <div
          style={{
            ...cardStyle,
            borderColor: 'var(--success)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ ...iconContainerStyle, backgroundColor: 'var(--success-soft)' }}>
              <DumbbellIcon size={24} style={{ color: 'var(--success)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: 'var(--text-h)' }}>
                Start Small. Build Over Time ⭐
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: '1.4' }}>
                Log today's workout and build your routine one session at a time.
              </p>
            </div>
          </div>
          <button
            onClick={handleQuickStart}
            disabled={quickStarting}
            style={{
              marginTop: 'auto',
              padding: '12px 16px',
              backgroundColor: quickStarting ? 'var(--placeholder)' : 'var(--success)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: quickStarting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s',
              opacity: quickStarting ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!quickStarting) {
                e.currentTarget.style.backgroundColor = '#16a34a';
              }
            }}
            onMouseLeave={(e) => {
              if (!quickStarting) {
                e.currentTarget.style.backgroundColor = 'var(--success)';
              }
            }}
          >
            {quickStarting ? 'Starting…' : 'Start Today'}
            {!quickStarting && <ArrowRightIcon size={16} />}
          </button>
        </div>
      </div>

      {Toast}
    </>
  );
};
