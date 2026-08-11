import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workoutSessionsApi } from '../api/workoutSessionsApi';
import type { WorkoutSession, LastActivePlan } from '../api/workoutSessionsApi';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { ArrowRightIcon, PlayIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardHeroProps {
  unresolvedSession: WorkoutSession | null;
  lastActivePlan: LastActivePlan | null;
  onUnresolvedSessionChange: (session: WorkoutSession | null) => void;
}

// Injected once, matching the existing pattern in Toast.tsx (inline animation keyframes
// can't live in a plain style object, so this is the codebase's established way to add them).
if (typeof document !== 'undefined' && !document.getElementById('dashboard-hero-styles')) {
  const style = document.createElement('style');
  style.id = 'dashboard-hero-styles';
  style.textContent = `
    @keyframes heroShimmer {
      0% { transform: translateX(220%); }
      100% { transform: translateX(-120%); }
    }
    @media (max-width: 640px) {
      .dashboard-hero-content {
        flex-direction: column;
        align-items: flex-start;
      }
      .dashboard-hero-actions {
        width: 100%;
      }
      .dashboard-hero-actions button {
        flex: 1 1 auto;
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(style);
}

const heroCardStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  // The app's real --accent blue, solid — a subtle diagonal shade using
  // --accent-hover/--accent-pressed for depth, not lightened toward white.
  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 60%, var(--accent-pressed) 100%)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 'var(--radius-card)',
  padding: '18px 24px',
  marginBottom: '24px',
  color: 'white',
};

const heroContentStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
  flexWrap: 'wrap',
};

const heroKickerStyle: React.CSSProperties = {
  margin: '0 0 4px 0',
  fontSize: '13px',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.85)',
  letterSpacing: '0.02em',
};

const heroButtonStyle: React.CSSProperties = {
  padding: '12px 20px',
  backgroundColor: 'white',
  color: 'var(--accent)',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  whiteSpace: 'nowrap',
};

const heroButtonGhostStyle: React.CSSProperties = {
  ...heroButtonStyle,
  backgroundColor: 'transparent',
  color: 'white',
  border: '1px solid white',
};

// Decorative layer shared by all three hero states: a soft light sweep that
// loops right-to-left across the card.
const HeroDecoration: React.FC = () => (
  <div
    aria-hidden
    style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: '45%',
        background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.25), transparent)',
        animation: 'heroShimmer 4.5s ease-in-out infinite',
      }}
    />
  </div>
);

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  unresolvedSession,
  lastActivePlan,
  onUnresolvedSessionChange,
}) => {
  const navigate = useNavigate();
  const { Toast, showToast } = useToast();
  const { t } = useLanguage();
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [quickStarting, setQuickStarting] = useState(false);

  const handleQuickStart = async () => {
    setQuickStarting(true);
    try {
      const response = await workoutSessionsApi.quickStart();
      navigate(`/workout-sessions/${response.session_id}`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast(t.hero.unresolvedConflict, 'error');
        return;
      }
      const errorMsg = err.response?.data?.error || (err as Error).message || t.hero.startFailed;
      showToast(errorMsg, 'error');
    } finally {
      setQuickStarting(false);
    }
  };

  if (unresolvedSession) {
    return (
      <div style={heroCardStyle}>
        <HeroDecoration />
        <div className="dashboard-hero-content" style={heroContentStyle}>
          <div>
            <p style={heroKickerStyle}>{t.hero.continueWorkout}</p>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'white' }}>
              {unresolvedSession.plan_name}
              {unresolvedSession.day_label && ` · ${unresolvedSession.day_label}`}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
              {t.hero.startedOn(new Date(unresolvedSession.started_at).toLocaleDateString())}
            </p>
          </div>
          <div className="dashboard-hero-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              style={heroButtonStyle}
              onClick={() => navigate(`/workout-sessions/${unresolvedSession.id}`)}
            >
              <PlayIcon size={14} />
              {t.hero.resume}
            </button>
            <button
              style={heroButtonGhostStyle}
              onClick={async () => {
                try {
                  await workoutSessionsApi.finishWorkout(unresolvedSession.id);
                  onUnresolvedSessionChange(null);
                  showToast(t.hero.finishedToast, 'success');
                } catch (error) {
                  console.error('Failed to finish workout:', error);
                  showToast(t.hero.finishFailed, 'error');
                }
              }}
            >
              {t.hero.markFinished}
            </button>
            <button style={heroButtonGhostStyle} onClick={() => setDiscardConfirm(true)}>
              {t.hero.discard}
            </button>
          </div>
        </div>

        <ConfirmDialog
          isOpen={discardConfirm}
          title={t.hero.discardTitle}
          message={t.hero.discardMessage}
          confirmText={t.hero.discard}
          cancelText={t.hero.cancel}
          isDangerous
          onConfirm={async () => {
            try {
              await workoutSessionsApi.discardSession(unresolvedSession.id);
              onUnresolvedSessionChange(null);
              setDiscardConfirm(false);
              showToast(t.hero.discardedToast, 'success');
            } catch (error) {
              console.error('Failed to discard workout:', error);
              showToast(t.hero.discardFailed, 'error');
            }
          }}
          onCancel={() => setDiscardConfirm(false)}
        />
        {Toast}
      </div>
    );
  }

  if (lastActivePlan) {
    return (
      <div style={heroCardStyle}>
        <HeroDecoration />
        <div className="dashboard-hero-content" style={heroContentStyle}>
          <div>
            <p style={heroKickerStyle}>{t.hero.continuePlan}</p>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'white' }}>
              {lastActivePlan.plan_name}
              {lastActivePlan.day_label && ` · ${lastActivePlan.day_label}`}
            </h2>
          </div>
          <button
            style={heroButtonStyle}
            onClick={() => navigate(`/workout-plans/${lastActivePlan.workout_plan_id}/start`)}
          >
            {t.hero.continueNow}
            <ArrowRightIcon size={16} />
          </button>
        </div>
        {Toast}
      </div>
    );
  }

  return (
    <div style={heroCardStyle}>
      <HeroDecoration />
      <div className="dashboard-hero-content" style={heroContentStyle}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 700, color: 'white' }}>
            {t.hero.readyTitle}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.85)' }}>
            {t.hero.readyBody}
          </p>
        </div>
        <div className="dashboard-hero-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={heroButtonStyle} onClick={() => navigate('/workout-plans/new')}>
            {t.hero.createPlan}
            <ArrowRightIcon size={16} />
          </button>
          <button style={heroButtonGhostStyle} onClick={() => navigate('/workout-plans')}>
            {t.hero.choosePlan}
            <ArrowRightIcon size={16} />
          </button>
          <button style={heroButtonGhostStyle} onClick={handleQuickStart} disabled={quickStarting}>
            {quickStarting ? t.hero.starting : t.hero.startEmpty}
            {!quickStarting && <ArrowRightIcon size={16} />}
          </button>
        </div>
      </div>
      {Toast}
    </div>
  );
};

export default DashboardHero;
