import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { Layout } from "../components/Layout";
import { UserIcon, ChevronDownIcon } from "../components/icons";
import type { WorkoutHistoryEntry } from "../api/workoutSessionsApi";
import { workoutSessionsApi } from "../api/workoutSessionsApi";

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentWorkouts = async () => {
      try {
        const data = await workoutSessionsApi.getWorkoutHistory();
        setRecentWorkouts(data.slice(0, 3));
      } catch (error) {
        console.error("Failed to load recent workouts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentWorkouts();
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <p className="kicker">Welcome back</p>
            <h1 className="page-title">{currentUser?.display_name}</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.7, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Login Username
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', border: '2px solid var(--accent)', borderRadius: '20px', backgroundColor: 'var(--bg-secondary)', width: 'fit-content', marginLeft: 'auto' }}>
              <UserIcon size={18} style={{ color: 'var(--text-h)', flexShrink: 0 }} />
              <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: '500', color: 'var(--text-h)' }}>
                @{currentUser?.username}
              </span>
              <ChevronDownIcon size={16} style={{ color: 'var(--text-h)', flexShrink: 0, marginLeft: '2px' }} />
            </div>
          </div>
        </div>

        <button className="create-tile" onClick={() => navigate("/workout-plans/new")}>
          <span className="plus">+</span>
          <span>
            <span className="label">Create exercise plan</span>
            <div className="sub">Name it, set the length, fill in the days.</div>
          </span>
        </button>

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
      </div>
    </Layout>
  );
};
