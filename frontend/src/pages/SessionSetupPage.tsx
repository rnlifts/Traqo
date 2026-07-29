import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workoutPlansApi, type WorkoutPlanDetail, type PlanDay } from '../api/workoutPlansApi';
import { workoutSessionsApi } from '../api/workoutSessionsApi';
import { useToast } from '../components/Toast';

export default function SessionSetupPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { Toast, showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planDetail, setPlanDetail] = useState<WorkoutPlanDetail | null>(null);

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
      if (!planId) {
        setError('Plan ID is required');
        return;
      }
      const detail = await workoutPlansApi.getDetail(Number(planId));
      setPlanDetail(detail);
      setError('');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || (err as Error).message || 'Failed to load plan';
      setError(errorMsg);
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
      return { isValid: false, message: 'No days available' };
    }

    const selectedDay = days[selectedDayIndex];
    if (!selectedDay) {
      return { isValid: false, message: 'Please select a day' };
    }

    if (selectedDay.is_rest) {
      return {
        isValid: false,
        message: `${selectedDay.label} is a rest day — pick another day, or edit the plan to add exercises here.`
      };
    }

    // Quick-start plans are meant to start empty — exercises get added live during the workout,
    // so they're exempt from the "must already have exercises" requirement below.
    if (!planDetail?.plan.is_quick_start && (!selectedDay.exercises || selectedDay.exercises.length === 0)) {
      return {
        isValid: false,
        message: `No exercises added for ${selectedDay.label} yet — edit the plan first.`
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
      showToast('Workout started!', 'success');
      navigate(`/workout-sessions/${response.session_id}`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast("Finish or discard your unresolved workout before starting a new one", "error");
        navigate("/dashboard");
        return;
      }
      const errorMsg = err.response?.data?.error || (err as Error).message || 'Failed to start workout';
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
      showToast('Workout started!', 'success');
      navigate(`/workout-sessions/${response.session_id}`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast("Finish or discard your unresolved workout before starting a new one", "error");
        navigate("/dashboard");
        return;
      }
      const errorMsg = err.response?.data?.error || (err as Error).message || 'Failed to start a new workout';
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

  if (loading) return <div className="loading">Loading plan...</div>;

  if (!planDetail) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: '20px' }}>
          <button onClick={() => navigate('/workout-plans')} className="btn btn-secondary">
            ← Back
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
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
          ← Back
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
              color: '#721c24',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 0 0 12px',
            }}
            aria-label="Dismiss error"
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
                Week {week.week_number}
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
              Repeat a previous day, or log something new:
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
                {loggingNewToday ? 'Starting...' : '+ Log new for today'}
              </button>
            )}
          </div>
        </div>
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
          {startingSession ? 'Starting...' : 'Begin workout →'}
        </button>
        <button
          onClick={() => navigate('/workout-plans')}
          className="btn btn-secondary"
          style={{ padding: '12px 24px', fontSize: '16px' }}
        >
          Cancel
        </button>
      </div>

      {Toast}
    </div>
  );
}
