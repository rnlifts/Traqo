import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sharingApi } from '../api/sharingApi';
import type { SharedPlanResponse, SharedPlanExercise, SharedPlanDay } from '../api/sharingApi';
import { ShareWorkoutStarter } from '../features/sharing/ShareWorkoutStarter';

function ExerciseCard({ exercise }: { exercise: SharedPlanExercise }) {
  return (
    <div className="exercise-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="field-cell field-cell-name">
        <span className="cell-label">Exercise</span>
        <span className="cell-static-value">{exercise.exercise_name}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {exercise.target_sets !== null && (
          <div className="field-cell">
            <span className="cell-label">Sets</span>
            <span className="cell-static-value">{exercise.target_sets}</span>
          </div>
        )}
        {exercise.target_reps && (
          <div className="field-cell">
            <span className="cell-label">Reps</span>
            <span className="cell-static-value">{exercise.target_reps}</span>
          </div>
        )}
        {exercise.target_weight !== null && (
          <div className="field-cell">
            <span className="cell-label">Weight</span>
            <span className="cell-static-value">{exercise.target_weight} lbs</span>
          </div>
        )}
        {exercise.target_duration_seconds !== null && (
          <div className="field-cell">
            <span className="cell-label">Duration</span>
            <span className="cell-static-value">
              {Math.floor(exercise.target_duration_seconds / 60)}m
            </span>
          </div>
        )}
      </div>
      {exercise.notes && (
        <div className="field-cell field-cell-notes">
          <span className="cell-label">Notes</span>
          <span className="cell-static-value" style={{ fontWeight: 'normal' }}>
            {exercise.notes}
          </span>
        </div>
      )}
    </div>
  );
}

function DayCard({ day }: { day: SharedPlanDay }) {
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--text-h)' }}>
        {day.is_rest ? '🛌 ' : ''}
        Day {day.order_position}: {day.label}
      </h3>
      {day.is_rest ? (
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>Rest day</p>
      ) : day.exercises.length > 0 ? (
        day.exercises.map((exercise, idx) => <ExerciseCard key={idx} exercise={exercise} />)
      ) : (
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>No exercises</p>
      )}
    </div>
  );
}

export const SharedPlanPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharedPlanResponse | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(
    null
  );

  useEffect(() => {
    if (token) {
      loadSharedPlan();
    }
  }, [token]);

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
          message: 'This link is invalid or no longer shared.',
        });
      } else if (err.response?.status === 403) {
        setError({
          status: 403,
          message:
            'This share is restricted — log in with an account that has access.',
        });
      } else {
        setError({
          status: 500,
          message: 'An error occurred while loading the shared plan.',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading plan...</div>;
  }

  if (error) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: '20px' }}>
          <button onClick={() => navigate('/workout-plans')} className="btn btn-secondary">
            ← Back
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h1 className="page-title" style={{ marginBottom: '12px' }}>
            {error.status === 404 ? 'Invalid Link' : 'Access Denied'}
          </h1>
          <p style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text)' }}>
            {error.message}
          </p>
          {error.status === 403 && (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              You can <Link to="/login">log in</Link> with an account that has access.
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

  return (
    <div className="page-container">
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
              Shared by <strong>{plan_owner_username}</strong> — you can{' '}
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
              Edit plan
            </Link>
          )}
        </div>
      </div>

      <p className="section-label">
        {plan.unit_type === 'days'
          ? `${plan.total_units} DAY${plan.total_units === 1 ? '' : 'S'}`
          : `${plan.total_units} WEEK${plan.total_units === 1 ? '' : 'S'}`}
      </p>

      {/* Workout Starter — only if permission allows */}
      {(permission === 'log' || permission === 'edit') && token && (
        <ShareWorkoutStarter data={data} token={token} />
      )}

      {/* Days-type plan */}
      {days && days.length > 0 && days.map((day) => <DayCard key={day.id} day={day} />)}

      {/* Weeks-type plan */}
      {weeks && weeks.length > 0 && (
        <>
          {weeks.map((week) => (
            <div key={week.week_number}>
              <p className="section-label">
                Week {week.resolved_week_number || week.week_number}
                {week.mode !== 'base' && ` (${week.mode})`}
              </p>
              {week.days.map((day) => (
                <DayCard key={day.id} day={day} />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default SharedPlanPage;
