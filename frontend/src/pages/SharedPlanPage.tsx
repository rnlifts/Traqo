import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sharingApi } from '../api/sharingApi';
import type { SharedPlanResponse, SharedPlanExercise, SharedPlanDay } from '../api/sharingApi';
import { ShareWorkoutStarter } from '../features/sharing/ShareWorkoutStarter';
import { ExercisePreviewPanel } from '../components/ExercisePreviewPanel';
import { ExerciseWorkoutPreview } from '../components/ExerciseWorkoutPreview';
import { Modal } from '../components/Modal';
import { getYoutubeThumbnailUrl } from '../utils/youtube';
import { useLanguage } from '../contexts/LanguageContext';
import type { TranslationKeys } from '../i18n/en';

interface PreviewInfo {
  name: string;
  video_url: string | null;
  muscle_group: string | null;
  equipment: string | null;
}

// Read-only exercise row matching Plan Builder's collapsed exercise card look
// (thumbnail + name + summary line) — clicking it opens the video preview,
// same as the owner's own plan view.
function ExerciseRow({
  exercise,
  index,
  t,
  onPreview,
}: {
  exercise: SharedPlanExercise;
  index: number;
  t: TranslationKeys;
  onPreview: (info: PreviewInfo) => void;
}) {
  const summaryText = [
    exercise.target_sets !== null ? t.planBuilder.setsCount(exercise.target_sets) : null,
    exercise.target_reps !== null ? t.planBuilder.repsCount(exercise.target_reps) : null,
    exercise.target_weight !== null ? t.planBuilder.lbsWeight(exercise.target_weight) : null,
    exercise.target_duration_seconds !== null
      ? `${Math.floor(exercise.target_duration_seconds / 60)}:${String(exercise.target_duration_seconds % 60).padStart(2, '0')}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const handleClick = () =>
    onPreview({
      name: exercise.exercise_name,
      video_url: exercise.video_url || null,
      muscle_group: exercise.muscle_group || null,
      equipment: exercise.equipment || null,
    });

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        marginBottom: '12px',
        cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {getYoutubeThumbnailUrl(exercise.video_url) ? (
          <img
            src={getYoutubeThumbnailUrl(exercise.video_url)!}
            alt={exercise.exercise_name}
            style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '8px',
              backgroundColor: 'var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-h)',
              fontSize: '20px',
            }}
          >
            🏋️
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '-4px',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {index + 1}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '14px',
            color: 'var(--text-h)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {exercise.exercise_name}
        </div>
        {summaryText && (
          <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '2px' }}>{summaryText}</div>
        )}
        {exercise.notes && (
          <div style={{ fontSize: '12px', color: 'var(--text)', fontStyle: 'italic', marginTop: '2px' }}>
            {exercise.notes}
          </div>
        )}
      </div>
    </div>
  );
}

export const SharedPlanPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharedPlanResponse | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(
    null
  );

  // Day/week navigation + video preview state — only used for view-only visitors.
  // (log/edit visitors get their own picker + preview via ShareWorkoutStarter.)
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedPreview, setSelectedPreview] = useState<PreviewInfo | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    if (token) {
      loadSharedPlan();
    }
  }, [token]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    setIsMobile(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  async function loadSharedPlan() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await sharingApi.getSharedPlan(token);
      setData(response);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError({
          status: 404,
          message: t.sharedPlanPage.invalidLinkMessage,
        });
      } else if (err.response?.status === 403) {
        setError({
          status: 403,
          message: t.sharedPlanPage.restrictedMessage,
        });
      } else {
        setError({
          status: 500,
          message: t.sharedPlanPage.genericErrorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const handlePreview = (info: PreviewInfo) => {
    setSelectedPreview(info);
    if (isMobile) setShowPreviewModal(true);
  };

  if (loading) {
    return <div className="loading">{t.sessionSetup.loadingPlan}</div>;
  }

  if (error) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: '20px' }}>
          <button onClick={() => navigate('/workout-plans')} className="btn btn-secondary">
            {t.planBuilder.back}
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h1 className="page-title" style={{ marginBottom: '12px' }}>
            {error.status === 404 ? t.sharedPlanPage.invalidLinkTitle : t.common2.accessDenied}
          </h1>
          <p style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text)' }}>
            {error.message}
          </p>
          {error.status === 403 && (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {t.sharedPlanPage.youCanLogInBefore}<Link to="/login">{t.sharedPlanPage.logIn}</Link>{t.sharedPlanPage.youCanLogInAfter}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { plan, days, weeks, permission, plan_owner_username } = data;
  // Edit-tier access via the plan-builder UI requires an authenticated viewer — the
  // builder assumes auth throughout, so an anonymous "anyone + edit" visitor simply
  // doesn't get the Edit button. This is a deliberate, documented limitation.
  const isAuthenticated = !!localStorage.getItem('auth_token');
  const canEditPlan = permission === 'edit' && isAuthenticated;

  const isWeeksType = plan.unit_type === 'weeks';
  const hasMultipleWeeks = isWeeksType && !!weeks && weeks.length > 1;
  const displayedDays: SharedPlanDay[] = isWeeksType
    ? weeks?.[selectedWeekIndex]?.days || []
    : days || [];
  const currentDay = displayedDays[selectedDayIndex];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Same header pattern as SessionSetupPage's plan card: small line, big title */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text)', fontWeight: 'normal' }}>
                  {t.sharedPlanPage.sharedByPrefix}<strong>{plan_owner_username}</strong>{t.sharedPlanPage.youCanPrefix}{' '}
                  <strong>{permission}</strong>
                </h2>
                <h1 style={{ margin: 0, fontSize: '28px', color: 'var(--text-h)', fontWeight: 'bold' }}>
                  {plan.name}
                </h1>
              </div>
              {canEditPlan && (
                <Link
                  to={`/workout-plans/${plan.id}/edit`}
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  {t.sharedPlanPage.editPlan}
                </Link>
              )}
            </div>
          </div>

          <p className="section-label">
            {plan.unit_type === 'days'
              ? t.planList.dayCount(plan.total_units)
              : t.planList.weekCount(plan.total_units)}
          </p>

          {permission === 'view' ? (
            // Same day-tab / week-rail navigation the owner sees in Plan Builder —
            // one day visible at a time, instead of dumping every day vertically.
            <>
              {hasMultipleWeeks && (
                <div className="panel" style={{ marginBottom: '20px' }}>
                  <label className="field-label">{t.planBuilder.weeksLabel}</label>
                  <div className="week-selector-row">
                    {weeks!.map((week, idx) => (
                      <div key={week.week_number} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={() => {
                            setSelectedWeekIndex(idx);
                            setSelectedDayIndex(0);
                          }}
                          className={`week-node${idx === selectedWeekIndex ? ' active' : ''}`}
                        >
                          {week.resolved_week_number || week.week_number}
                        </button>
                        {idx < weeks!.length - 1 && <div className="week-connector" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {displayedDays.length > 0 && (
                <div className="day-tabs">
                  {displayedDays.map((day, idx) => (
                    <button
                      key={day.id}
                      onClick={() => setSelectedDayIndex(idx)}
                      className={`day-tab${idx === selectedDayIndex ? ' active' : ''}`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              )}

              {currentDay ? (
                currentDay.is_rest ? (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'var(--text)', fontSize: '14px' }}>
                      {t.sharedPlanPage.restDay}
                    </p>
                  </div>
                ) : currentDay.exercises.length > 0 ? (
                  <div>
                    {currentDay.exercises.map((exercise, idx) => (
                      <ExerciseRow key={idx} exercise={exercise} index={idx} t={t} onPreview={handlePreview} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>{t.sharedPlanPage.noExercises}</p>
                  </div>
                )
              ) : (
                <div className="empty-state">
                  <p>{t.sharedPlanPage.noExercises}</p>
                </div>
              )}
            </>
          ) : (
            // log/edit permission: ShareWorkoutStarter's own picker + per-day preview
            // replaces the day-tab view above, so the same content isn't shown twice at once.
            token && <ShareWorkoutStarter data={data} token={token} />
          )}
        </div>

        {/* Preview side panel (desktop only, view-only visitors) */}
        {permission === 'view' && !isMobile && (
          <div style={{ flexShrink: 0 }}>
            <ExercisePreviewPanel selected={selectedPreview} fullWidth={false} />
          </div>
        )}
      </div>

      {/* Preview modal (mobile only, view-only visitors) */}
      {permission === 'view' && isMobile && selectedPreview && (
        <Modal isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} title={selectedPreview.name} fullScreen={true}>
          <ExerciseWorkoutPreview
            name={selectedPreview.name}
            video_url={selectedPreview.video_url}
            muscle_group={selectedPreview.muscle_group}
            equipment={selectedPreview.equipment}
          />
        </Modal>
      )}
    </div>
  );
};

export default SharedPlanPage;
