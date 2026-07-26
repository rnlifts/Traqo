import React from "react";
import { Link } from "react-router-dom";
import type { WorkoutHistoryEntry } from "../../api/workoutSessionsApi";
import { CalendarIcon, ClipboardIcon, ClockIcon, ArrowRightIcon } from "../../components/icons";

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} className="error-message">
        <span>Error: {error}</span>
        {onDismissError && (
          <button
            onClick={onDismissError}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              fontSize: "20px",
              cursor: "pointer",
              padding: "0 0 0 12px",
              flex: "0 0 auto",
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
    <div className="history-list">
      {entries.map((entry, index) => (
        <div key={index} className="history-row">
          <div className="field-group">
            <span className="icon-badge">
              <CalendarIcon size={18} />
            </span>
            <div>
              <p className="field-group-label">Date</p>
              <p className="field-group-value">{new Date(entry.date).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="field-group">
            <span className="icon-badge">
              <ClipboardIcon size={18} />
            </span>
            <div>
              <p className="field-group-label">Workout</p>
              <p className="field-group-value">{entry.workout}</p>
            </div>
          </div>

          <div className="field-group">
            <span className="icon-badge">
              <ClockIcon size={18} />
            </span>
            <div>
              <p className="field-group-label">Duration</p>
              <p className="field-group-value">{entry.duration}</p>
            </div>
          </div>

          {entry.session_id && (
            <Link
              to={`/workout-history/${entry.session_id}`}
              className="btn btn-primary"
              style={{ whiteSpace: "nowrap" }}
              aria-label={`View details for ${entry.workout} on ${new Date(entry.date).toLocaleDateString()}`}
            >
              View Details
              <ArrowRightIcon size={15} />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
};
