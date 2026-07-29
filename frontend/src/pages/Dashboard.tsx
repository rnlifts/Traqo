import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PlanActionCards } from "../components/PlanActionCards";
import type { WorkoutHistoryEntry, WorkoutSession } from "../api/workoutSessionsApi";
import { workoutSessionsApi } from "../api/workoutSessionsApi";

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { Toast, showToast } = useToast();
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutHistoryEntry[]>([]);
  const [unresolvedSession, setUnresolvedSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyData, sessionData] = await Promise.all([
          workoutSessionsApi.getWorkoutHistory(),
          workoutSessionsApi.getUnresolvedSession(),
        ]);
        setRecentWorkouts(historyData.slice(0, 3));
        setUnresolvedSession(sessionData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " · " +
      date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    );
  };

  return (
    <Layout>
      <div className="page-container">
        <div style={{ marginBottom: '24px' }}>
          <p className="kicker">Welcome back</p>
          <h1 className="page-title">{currentUser?.display_name}</h1>
        </div>

        <PlanActionCards />

        {unresolvedSession && (
          <div style={{
            backgroundColor: 'var(--info-soft, #dbeafe)',
            border: '1px solid var(--info, #3b82f6)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <strong>You have an unfinished workout</strong>
              <p style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-h)' }}>
                <strong>{unresolvedSession.plan_name}</strong> ({unresolvedSession.day_label || 'Day'})
                {' · '} started {new Date(unresolvedSession.started_at).toLocaleDateString()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/workout-sessions/${unresolvedSession.id}`)}
              >
                Resume
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await workoutSessionsApi.finishWorkout(unresolvedSession.id);
                    setUnresolvedSession(null);
                    showToast('Workout marked as finished!', 'success');
                  } catch (error) {
                    console.error('Failed to finish workout:', error);
                    showToast('Failed to finish workout', 'error');
                  }
                }}
              >
                Mark as Finished
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setDiscardConfirm(true)}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={discardConfirm}
          title="Discard Workout"
          message="This will permanently delete today's logged sets for this workout. This can't be undone."
          confirmText="Discard"
          cancelText="Cancel"
          isDangerous
          onConfirm={async () => {
            if (!unresolvedSession) return;
            try {
              await workoutSessionsApi.discardSession(unresolvedSession.id);
              setUnresolvedSession(null);
              setDiscardConfirm(false);
              showToast('Workout discarded.', 'success');
            } catch (error) {
              console.error('Failed to discard workout:', error);
              showToast('Failed to discard workout', 'error');
            }
          }}
          onCancel={() => setDiscardConfirm(false)}
        />

        <p className="section-label">Recent workouts</p>
        {loading ? (
          <div className="loading">Loading workout history...</div>
        ) : recentWorkouts.length > 0 ? (
          <div className="history-list">
            {recentWorkouts.map((workout, idx) => (
              <div
                key={idx}
                className="history-row"
                onClick={() => workout.session_id && navigate(`/workout-history/${workout.session_id}`)}
              >
                <div className="h-left">
                  <strong>{workout.workout}</strong>
                  <div className="h-date">{formatDate(workout.date)}</div>
                </div>
                <div className="h-stat">{workout.duration}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">No workouts yet — start one from a plan to see it here.</p>
        )}
        {Toast}
      </div>
    </Layout>
  );
};
