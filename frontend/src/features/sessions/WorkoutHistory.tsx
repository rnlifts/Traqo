import React from "react";
import type { WorkoutHistoryEntry } from "../../api/workoutSessionsApi";

interface WorkoutHistoryProps {
  entries: WorkoutHistoryEntry[];
  loading: boolean;
  error: string | null;
  onDismissError?: () => void;
}

export const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({
  entries,
  loading,
  error,
  onDismissError,
}) => {
  if (loading) {
    return <div className="loading">Loading workout history...</div>;
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="error-message">
        <span>Error: {error}</span>
        {onDismissError && (
          <button
            onClick={onDismissError}
            style={{
              background: 'none',
              border: 'none',
              color: '#721c24',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 0 0 12px',
              flex: '0 0 auto'
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p>No finished workouts yet. Start a workout to begin tracking!</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Workout History</h2>
      <div style={{ display: "grid", gap: "12px" }}>
        {entries.map((entry, index) => (
          <div key={index} className="card">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>Date</p>
                <p style={{ margin: "0", fontWeight: "bold" }}>
                  {new Date(entry.date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>Workout</p>
                <p style={{ margin: "0", fontWeight: "bold" }}>{entry.workout}</p>
              </div>
              <div>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>Duration</p>
                <p style={{ margin: "0", fontWeight: "bold" }}>{entry.duration}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
