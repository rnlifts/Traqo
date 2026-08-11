import React from "react";
import { Link } from "react-router-dom";
import type { WorkoutHistoryEntry } from "../../api/workoutSessionsApi";
import { CalendarIcon, ClipboardIcon, ClockIcon, ArrowRightIcon } from "../../components/icons";
import { useLanguage } from "../../contexts/LanguageContext";

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
  const { t } = useLanguage();

  if (loading) {
    return <div className="loading">{t.workoutHistory.loading}</div>;
  }

  if (error) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} className="error-message">
        <span>{t.workoutHistory.errorPrefix(error)}</span>
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
            aria-label={t.workoutHistory.dismissError}
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
        <p>{t.workoutHistory.empty}</p>
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
              <p className="field-group-label">{t.workoutHistory.dateLabel}</p>
              <p className="field-group-value">{new Date(entry.date).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="field-group">
            <span className="icon-badge">
              <ClipboardIcon size={18} />
            </span>
            <div>
              <p className="field-group-label">{t.workoutHistory.workoutLabel}</p>
              <p className="field-group-value">{entry.workout}</p>
            </div>
          </div>

          <div className="field-group">
            <span className="icon-badge">
              <ClockIcon size={18} />
            </span>
            <div>
              <p className="field-group-label">{t.workoutHistory.durationLabel}</p>
              <p className="field-group-value">{entry.duration}</p>
            </div>
          </div>

          {entry.session_id && (
            <Link
              to={`/workout-history/${entry.session_id}`}
              className="btn btn-primary"
              style={{ whiteSpace: "nowrap" }}
              aria-label={t.workoutHistory.viewDetailsAria(entry.workout, new Date(entry.date).toLocaleDateString())}
            >
              {t.workoutHistory.viewDetails}
              <ArrowRightIcon size={15} />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
};
