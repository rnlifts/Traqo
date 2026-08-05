import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sharingApi } from '../api/sharingApi';
import type { SharedPlanResponse } from '../api/sharingApi';
import { ShareWorkoutStarter } from '../features/sharing/ShareWorkoutStarter';

export const SharedPlanPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
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
    return (
      <div className="page-container">
        <div className="loading">Loading shared plan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
            {error.status === 404 ? 'Invalid Link' : 'Access Denied'}
          </h1>
          <p style={{ fontSize: '16px', marginBottom: '20px', color: 'var(--text)' }}>
            {error.message}
          </p>
          {error.status === 403 && (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              You can{' '}
              <a href="/login" style={{ color: '#007bff', textDecoration: 'none' }}>
                log in
              </a>{' '}
              with an account that has access.
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
      {/* Banner */}
      <div
        style={{
          padding: '16px',
          backgroundColor: 'var(--bg-hover)',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: '14px' }}>
          Shared by <strong>{plan_owner_username}</strong> — you can{' '}
          <strong>{permission}</strong>.
        </p>
      </div>

      {/* Plan Info */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <h1 className="page-title">{plan.name}</h1>
          {canEditPlan && (
            <Link
              to={`/workout-plans/${plan.id}/edit`}
              className="btn btn-secondary"
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Edit plan
            </Link>
          )}
        </div>
        <p className="section-label">
          {plan.unit_type === 'days'
            ? `${plan.total_units} DAY${plan.total_units === 1 ? '' : 'S'}`
            : `${plan.total_units} WEEK${plan.total_units === 1 ? '' : 'S'}`}
        </p>
      </div>

      {/* Workout Starter — only if permission allows */}
      {(data.permission === 'log' || data.permission === 'edit') && token && (
        <ShareWorkoutStarter data={data} token={token} />
      )}

      {/* Days Plan */}
      {days && days.length > 0 && (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Days
          </h2>
          {days.map((day) => (
            <div
              key={day.id}
              style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: 'var(--bg-hover)',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                  {day.is_rest ? '🛌 ' : ''} Day {day.order_position}: {day.label}
                </h3>
              </div>

              {day.is_rest ? (
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                  Rest day
                </p>
              ) : day.exercises.length > 0 ? (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    fontSize: '14px',
                  }}
                >
                  {day.exercises.map((exercise, idx) => (
                    <li
                      key={idx}
                      style={{
                        marginBottom: '8px',
                        color: 'var(--text)',
                      }}
                    >
                      <strong>{exercise.exercise_name}</strong>
                      {exercise.target_sets !== null && (
                        <span> • {exercise.target_sets} sets</span>
                      )}
                      {exercise.target_reps && (
                        <span> • {exercise.target_reps} reps</span>
                      )}
                      {exercise.target_weight !== null && (
                        <span> • {exercise.target_weight}lbs</span>
                      )}
                      {exercise.target_duration_seconds !== null && (
                        <span>
                          {' '}
                          • {Math.floor(exercise.target_duration_seconds / 60)}m
                        </span>
                      )}
                      {exercise.notes && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            marginTop: '4px',
                          }}
                        >
                          Note: {exercise.notes}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                  No exercises
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Weeks Plan */}
      {weeks && weeks.length > 0 && (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Weeks
          </h2>
          {weeks.map((week) => (
            <div
              key={week.week_number}
              style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: 'var(--bg-hover)',
                borderRadius: '8px',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                Week {week.resolved_week_number || week.week_number}
                {week.mode !== 'base' && ` (${week.mode})`}
              </h3>

              {week.days.map((day) => (
                <div
                  key={day.id}
                  style={{
                    marginBottom: '12px',
                    paddingLeft: '16px',
                    borderLeft: '2px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        fontWeight: '600',
                      }}
                    >
                      {day.is_rest ? '🛌 ' : ''} Day {day.order_position}:{' '}
                      {day.label}
                    </h4>
                  </div>

                  {day.is_rest ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Rest day
                    </p>
                  ) : day.exercises.length > 0 ? (
                    <ul
                      style={{
                        margin: '0',
                        paddingLeft: '20px',
                        fontSize: '12px',
                      }}
                    >
                      {day.exercises.map((exercise, idx) => (
                        <li
                          key={idx}
                          style={{
                            marginBottom: '4px',
                            color: 'var(--text)',
                          }}
                        >
                          <strong>{exercise.exercise_name}</strong>
                          {exercise.target_sets !== null && (
                            <span> • {exercise.target_sets} sets</span>
                          )}
                          {exercise.target_reps && (
                            <span> • {exercise.target_reps} reps</span>
                          )}
                          {exercise.target_weight !== null && (
                            <span> • {exercise.target_weight}lbs</span>
                          )}
                          {exercise.target_duration_seconds !== null && (
                            <span>
                              {' '}
                              •{' '}
                              {Math.floor(exercise.target_duration_seconds / 60)}m
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      No exercises
                    </p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SharedPlanPage;
