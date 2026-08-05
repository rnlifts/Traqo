import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sharingApi } from '../../api/sharingApi';
import type { SharedPlanResponse } from '../../api/sharingApi';
import { AnonymousWorkoutLogger } from './AnonymousWorkoutLogger';
import { useToast } from '../../components/Toast';

interface Props {
  data: SharedPlanResponse;
  token: string;
}

export const ShareWorkoutStarter: React.FC<Props> = ({ data, token }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [showPicker, setShowPicker] = useState(false);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [sessionStarted, setSessionStarted] = useState<{
    sessionId: number;
    exercises: any[];
  } | null>(null);

  // Only show for log/edit permission
  if (data.permission === 'view') {
    return null;
  }

  // Get the currently displayed days
  function getDisplayedDays() {
    if (data.plan.unit_type === 'weeks' && data.weeks) {
      const week = data.weeks[selectedWeekIndex];
      return week ? week.days : [];
    } else if (data.days) {
      return data.days;
    }
    return [];
  }

  async function handleBeginWorkout() {
    setError('');
    const days = getDisplayedDays();
    const selectedDay = days[selectedDayIndex];

    if (!selectedDay) return;

    if (selectedDay.is_rest) {
      showToast('Cannot start a workout on a rest day', 'error');
      return;
    }

    setStarting(true);
    try {
      const weekNumber =
        data.plan.unit_type === 'weeks' ? selectedWeekIndex + 1 : undefined;
      const response = await sharingApi.startWorkoutViaShare(token, {
        plan_day_id: selectedDay.id,
        week_number: weekNumber,
      });

      // Check if user is authenticated
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        // Authenticated recipient: navigate to normal Active Workout
        navigate(`/workout-sessions/${response.session_id}`);
      } else {
        // Anonymous visitor: switch to logging view
        setSessionStarted({
          sessionId: response.session_id,
          exercises: selectedDay.exercises,
        });
        setShowPicker(false);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Permission denied. Share may have been revoked or downgraded.');
        showToast('Permission denied', 'error');
      } else {
        const errorMsg =
          err.response?.data?.error ||
          (err as Error).message ||
          'Failed to start workout';
        setError(errorMsg);
        showToast(errorMsg, 'error');
      }
      setStarting(false);
    }
  }

  // If workout has started for anonymous user, show logger
  if (sessionStarted) {
    return (
      <AnonymousWorkoutLogger
        token={token}
        sessionId={sessionStarted.sessionId}
        exercises={sessionStarted.exercises}
      />
    );
  }

  const isWeeksType = data.plan.unit_type === 'weeks';
  const hasMultipleWeeks = isWeeksType && data.weeks && data.weeks.length > 1;
  const displayedDays = getDisplayedDays();
  const showDayPicker = displayedDays.length > 0;

  return (
    <div style={{ marginTop: '24px' }}>
      {!showPicker ? (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setShowPicker(true)}
            className="btn btn-success"
            style={{
              padding: '12px 24px',
              fontSize: '16px',
            }}
          >
            Start workout
          </button>
        </div>
      ) : (
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--bg-hover)',
            borderRadius: '8px',
            marginBottom: '20px',
          }}
        >
          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                borderRadius: '4px',
                color: '#721c24',
                marginBottom: '16px',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* Week Chips */}
          {hasMultipleWeeks && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {data.weeks?.map((week, idx) => (
                  <button
                    key={week.week_number}
                    onClick={() => {
                      setSelectedWeekIndex(idx);
                      setSelectedDayIndex(0);
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
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {displayedDays.map((day, idx) => (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDayIndex(idx)}
                    className={`setup-chip ${idx === selectedDayIndex ? 'active' : ''} ${
                      day.is_rest ? 'is-rest' : ''
                    }`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: day.is_rest ? 0.5 : 1,
                      cursor: day.is_rest ? 'not-allowed' : 'pointer',
                    }}
                    disabled={day.is_rest}
                  >
                    {day.label}
                    {day.is_rest && <span style={{ fontSize: '8px' }}>●</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Begin Button */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={handleBeginWorkout}
              disabled={starting}
              className="btn btn-success"
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                cursor: starting ? 'not-allowed' : 'pointer',
                opacity: starting ? 0.6 : 1,
              }}
            >
              {starting ? 'Starting...' : 'Begin'}
            </button>
            <button
              onClick={() => setShowPicker(false)}
              className="btn btn-secondary"
              style={{ padding: '12px 24px', fontSize: '16px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareWorkoutStarter;
