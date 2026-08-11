import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workoutPlansApi, type WorkoutPlanDetail, type PlanDay } from '../api/workoutPlansApi';
import { workoutSessionsApi } from '../api/workoutSessionsApi';
import { exercisesApi, type Exercise } from '../api/exercisesApi';
import { useToast } from '../components/Toast';
import { WorkoutPreviewList } from '../components/WorkoutPreviewList';
import { useLanguage } from '../contexts/LanguageContext';

export default function SessionSetupPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { Toast, showToast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [planDetail, setPlanDetail] = useState<WorkoutPlanDetail | null>(null);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [startingSession, setStartingSession] = useState(false);
  const [loggingNewToday, setLoggingNewToday] = useState(false);

  useEffect(() => {
    loadPlan();
  }, [planId]);

  async function loadPlan() {
    try {
      setLoading(true);
      setLoadError(null);
      if (!planId || Number.isNaN(Number(planId))) {
        setLoadError({ status: 404, message: t.sessionSetup.planNotFoundMessage });
        return;
      }
      // Fetch plan detail and exercises in parallel
      const [detail, exercises] = await Promise.all([
        workoutPlansApi.getDetail(Number(planId)),
        exercisesApi.list(),
      ]);
      setPlanDetail(detail);
      setAvailableExercises(exercises);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setLoadError({ status: 404, message: t.sessionSetup.planNotFoundMessage });
      } else if (err.response?.status === 403) {
        setLoadError({ status: 403, message: t.sessionSetup.accessDeniedMessage });
      } else {
        const errorMsg = err.response?.data?.error || (err as Error).message || t.sessionSetup.loadPlanFailed;
        setLoadError({ status: 500, message: errorMsg });
      }
    } finally {
      setLoading(false);
    }
  }

  // Get the currently displayed days (backend has already resolved weeks)
  function getDisplayedDays(): PlanDay[] {
    if (!planDetail) return [];

    if (planDetail.plan.unit_type === 'weeks' && planDetail.weeks) {
      // Backend has already resolved the effective days for each week
      const week = planDetail.weeks[selectedWeekIndex];
      return week ? week.days : [];
    } else if (planDetail.days) {
      return planDetail.days;
    }
    return [];
  }

  // Validate the currently selected day
  function getValidationState() {
    const days = getDisplayedDays();
    if (days.length === 0) {
      return { isValid: false, message: t.sessionSetup.noDaysAvailable };
    }

    const selectedDay = days[selectedDayIndex];
    if (!selectedDay) {
      return { isValid: false, message: t.sessionSetup.selectDay };
    }

    if (selectedDay.is_rest) {
      return {
        isValid: false,
        message: t.sessionSetup.restDayMessage(selectedDay.label)
      };
    }

    // Quick-start plans are meant to start empty — exercises get added live during the workout,
    // so they're exempt from the "must already have exercises" requirement below.
    if (!planDetail?.plan.is_quick_start && (!selectedDay.exercises || selectedDay.exercises.length === 0)) {
      return {
        isValid: false,
        message: t.sessionSetup.noExercisesMessage(selectedDay.label)
      };
    }

    return { isValid: true, message: '' };
  }

  async function handleBeginWorkout() {
    if (!planId || !planDetail) return;

    const days = getDisplayedDays();
    const selectedDay = days[selectedDayIndex];
    if (!selectedDay) return;

    const validation = getValidationState();
    if (!validation.isValid) {
      showToast(validation.message, 'error');
      return;
    }

    setStartingSession(true);
    try {
      const weekNumber = planDetail.plan.unit_type === 'weeks' ? selectedWeekIndex + 1 : undefined;
      const response = await workoutSessionsApi.startWorkout(Number(planId), selectedDay.id, weekNumber);
      showToast(t.sessionSetup.workoutStarted, 'success');
      // Pass prefetched plan and exercises to ActiveWorkoutPage to avoid refetching
      navigate(`/workout-sessions/${response.session_id}`, {
        state: { prefetchedPlanDetail: planDetail, prefetchedExercises: availableExercises },
      });
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast(t.hero.unresolvedConflict, "error");
        navigate("/dashboard");
        return;
      }
      const errorMsg = err.response?.data?.error || (err as Error).message || t.sharing.startWorkoutFailed;
      setError(errorMsg);
      setStartingSession(false);
    }
  }

  // Quick-start only: create a brand-new day and jump straight into the workout, no extra click.
  async function handleLogNewToday() {
    if (!planId) return;
    setLoggingNewToday(true);
    try {
      const days = getDisplayedDays();
      const newDay = await workoutPlansApi.createDay(Number(planId), `Day ${days.length + 1}`);
      let response;
      try {
        response = await workoutSessionsApi.startWorkout(Number(planId), newDay.id);
      } catch (startErr: any) {
        // startWorkout failed after the day was already created — clean up the
        // orphaned day so a blocked/failed attempt doesn't leave empty junk behind.
        await workoutPlansApi.deleteDay(Number(planId), newDay.id).catch(() => {});
        throw startErr;
      }
      showToast(t.sessionSetup.workoutStarted, 'success');
      navigate(`/workout-sessions/${response.session_id}`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast(t.hero.unresolvedConflict, "error");
        navigate("/dashboard");
        return;
      }
      const errorMsg = err.response?.data?.error || (err as Error).message || t.sessionSetup.startNewWorkoutFailed;
      setError(errorMsg);
      setLoggingNewToday(false);
    }
  }

  // For quick-start plans, label each day by the date it was logged instead of "Day N",
  // so picking one to repeat is meaningful.
  function formatDayLabel(day: PlanDay): string {
    if (!day.created_at) return day.label;
    const date = new Date(day.created_at);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  if (loading) return <div className="loading">{t.sessionSetup.loadingPlan}</div>;

  if (loadError || !planDetail) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: '20px' }}>
          <button onClick={() => navigate('/workout-plans')} className="btn btn-secondary">
            {t.planBuilder.back}
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h1 className="page-title" style={{ marginBottom: '12px' }}>
            {loadError?.status === 404 ? t.sessionSetup.planNotFoundTitle : loadError?.status === 403 ? t.common2.accessDenied : t.common2.somethingWentWrong}
          </h1>
          <p style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text)' }}>
            {loadError?.message || t.sessionSetup.somethingWentWrongMessage}
          </p>
          <button onClick={() => navigate('/workout-plans')} className="btn btn-primary">
            {t.common2.backToPlans}
          </button>
        </div>
      </div>
    );
  }

  const isWeeksType = planDetail.plan.unit_type === 'weeks';
  const hasMultipleWeeks = isWeeksType && planDetail.weeks && planDetail.weeks.length > 1;
  const displayedDays = getDisplayedDays();
  const hasMultipleDays = displayedDays.length > 1;
  const isQuickStart = !!planDetail.plan.is_quick_start;
  const showDayPicker = hasMultipleDays || isQuickStart;
  const validation = getValidationState();

  const selectedDay = displayedDays[selectedDayIndex];
  const dayLabel = selectedDay?.label || 'Unknown';
  const headerLabel = isWeeksType && selectedDay
    ? `Week ${selectedWeekIndex + 1} · ${dayLabel}`
    : dayLabel;

  return (
    <div className="page-container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => navigate('/workout-plans')} className="btn btn-secondary">
          {t.planBuilder.back}
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }} className="error-message">
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 0 0 12px',
            }}
            aria-label={t.planBuilder.dismissError}
          >
            ×
          </button>
        </div>
      )}

      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text)', fontWeight: 'normal' }}>
          {planDetail.plan.name}
        </h2>
        <h1 style={{ margin: 0, fontSize: '28px', color: 'var(--text-h)', fontWeight: 'bold' }}>
          {headerLabel}
        </h1>
      </div>

      {/* Week Chips */}
      {hasMultipleWeeks && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {planDetail.weeks?.map((week, idx) => (
              <button
                key={week.week_number}
                onClick={() => {
                  setSelectedWeekIndex(idx);
                  setSelectedDayIndex(0); // Reset to first day when changing week
                }}
                className={`setup-chip ${idx === selectedWeekIndex ? 'active' : ''}`}
              >
                {t.sharing.weekChip(week.week_number)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day Chips */}
      {showDayPicker && (
        <div style={{ marginBottom: '20px' }}>
          {isQuickStart && (
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text)' }}>
              {t.sessionSetup.repeatOrLogNew}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {displayedDays.map((day, idx) => (
              <button
                key={day.id}
                onClick={() => setSelectedDayIndex(idx)}
                className={`setup-chip ${idx === selectedDayIndex ? 'active' : ''} ${day.is_rest ? 'is-rest' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isQuickStart ? formatDayLabel(day) : day.label}
                {day.is_rest && <span style={{ fontSize: '8px', color: 'var(--border)' }}>●</span>}
              </button>
            ))}
            {isQuickStart && (
              <button
                onClick={handleLogNewToday}
                disabled={loggingNewToday}
                className="setup-chip"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: loggingNewToday ? 0.6 : 1,
                  cursor: loggingNewToday ? 'not-allowed' : 'pointer',
                }}
              >
                {loggingNewToday ? t.sharing.starting : t.sessionSetup.logNewToday}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview of the currently selected day's exercises */}
      {selectedDay && !selectedDay.is_rest && selectedDay.exercises && selectedDay.exercises.length > 0 && (
        <WorkoutPreviewList title={t.sharing.workoutPreviewTitle} exercises={selectedDay.exercises} />
      )}

      {/* Validation Message */}
      {!validation.isValid && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--warning)',
          border: '1px solid var(--warning)',
          borderRadius: '8px',
          color: 'var(--surface)',
          marginBottom: '20px',
          fontSize: '14px',
          opacity: 0.9
        }}>
          {validation.message}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button
          onClick={handleBeginWorkout}
          disabled={!validation.isValid || startingSession}
          className="btn btn-success"
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            cursor: !validation.isValid || startingSession ? 'not-allowed' : 'pointer',
            opacity: !validation.isValid || startingSession ? 0.6 : 1,
          }}
        >
          {startingSession ? t.sharing.starting : t.sharing.beginWorkout}
        </button>
        <button
          onClick={() => navigate('/workout-plans')}
          className="btn btn-secondary"
          style={{ padding: '12px 24px', fontSize: '16px' }}
        >
          {t.planBuilder.cancel}
        </button>
      </div>

      {Toast}
    </div>
  );
}
