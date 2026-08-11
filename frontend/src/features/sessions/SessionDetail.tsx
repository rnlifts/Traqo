import React from "react";
import { Link } from "react-router-dom";
import type { WorkoutSessionDetail, WorkoutSetWithExercise } from "../../api/workoutSessionsApi";
import type { PlanDay } from "../../api/workoutPlansApi";
import { useLanguage } from "../../contexts/LanguageContext";

interface SessionDetailProps {
  session: WorkoutSessionDetail["session"];
  sets: WorkoutSetWithExercise[];
  matchingDay: PlanDay | null;
  dayLabel: string;
  planName?: string;
}

export const SessionDetail: React.FC<SessionDetailProps> = ({
  session,
  sets,
  matchingDay,
  dayLabel,
  planName,
}) => {
  const { t } = useLanguage();
  const displayPlanName = planName ?? t.sessionDetail.defaultPlanName;
  // Check if session is still in progress
  const isInProgress = session.completed_at === null;
  const durationText = isInProgress
    ? t.sessionDetail.inProgress
    : session.duration_minutes != null
      ? t.sessionDetail.durationMin(session.duration_minutes)
      : t.sessionDetail.unknownDuration;

  const buildTargetLine = (
    targetSets: number | null,
    targetReps: string | null,
    targetWeight: number | null
  ): string | null => {
    const parts: string[] = [];
    if (targetSets !== null) parts.push(t.sessionDetail.setsCount(targetSets));
    if (targetReps !== null) parts.push(t.sessionDetail.repsCount(targetReps));
    if (targetWeight !== null) parts.push(t.sessionDetail.lbsWeight(targetWeight));
    if (parts.length === 0) return null;
    return t.sessionDetail.targetPrefix + parts.join(" × ");
  };

  return (
    <div className="page-container">
      {/* In-progress banner */}
      {isInProgress && (
        <div
          className="card"
          style={{
            marginBottom: "20px",
            backgroundColor: "var(--success-bg)",
            borderColor: "var(--success-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "var(--text-h)", fontWeight: "500" }}>
            {t.sessionDetail.inProgressBanner}
          </span>
          <Link
            to={`/workout-sessions/${session.id}`}
            className="btn btn-success"
            style={{ marginLeft: "16px" }}
          >
            {t.sessionDetail.continueWorkout}
          </Link>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 8px 0" }}>{displayPlanName}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div>
            <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>{t.sessionDetail.dayLabel}</p>
            <p style={{ margin: "0", fontWeight: "bold" }}>{dayLabel}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>{t.sessionDetail.dateLabel}</p>
            <p style={{ margin: "0", fontWeight: "bold" }}>
              {new Date(session.started_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>{t.sessionDetail.durationLabel}</p>
            <p style={{ margin: "0", fontWeight: "bold" }}>{durationText}</p>
          </div>
        </div>
      </div>

      {/* Exercises */}
      {matchingDay && matchingDay.exercises.length > 0 ? (
        <div style={{ display: "grid", gap: "16px" }}>
          {matchingDay.exercises.map((exercise) => {
            // Get all sets for this plan-exercise instance
            const exerciseSets = sets
              .filter((s) => s.workout_exercise_id === exercise.id)
              .sort((a, b) => a.set_number - b.set_number);

            const targetLine = buildTargetLine(
              exercise.target_sets,
              exercise.target_reps,
              exercise.target_weight
            );

            return (
              <div key={exercise.id} className="card">
                {/* Exercise name as link */}
                <Link
                  to={`/exercises/${exercise.exercise_id}/progress`}
                  style={{
                    textDecoration: "none",
                    color: "var(--accent)",
                    fontWeight: "bold",
                    fontSize: "16px",
                    marginBottom: "8px",
                    display: "inline-block",
                  }}
                >
                  {exercise.exercise_name || t.sessionDetail.exerciseFallback(exercise.exercise_id)}
                </Link>

                {/* Target line */}
                {targetLine && (
                  <div style={{ color: "var(--text)", fontSize: "14px", marginBottom: "12px" }}>
                    {targetLine}
                  </div>
                )}

                {/* Sets list or empty state */}
                {exerciseSets.length > 0 ? (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {exerciseSets.map((set) => (
                      <div
                        key={set.id}
                        style={{
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border)",
                          padding: "8px 12px",
                          borderRadius: "16px",
                          fontSize: "14px",
                        }}
                      >
                        <div style={{ fontWeight: "500" }}>
                          {t.sessionDetail.setLabel(set.set_number, set.weight, set.reps, set.duration_seconds)}
                        </div>
                        {set.notes && (
                          <div style={{ fontSize: "13px", color: "var(--text)", fontStyle: "italic", marginTop: "4px" }}>
                            {set.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: "16px 0" }}>
                    <p>{t.sessionDetail.noSetsLogged}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : sets.length > 0 ? (
        <div style={{ display: "grid", gap: "16px" }}>
          {Array.from(
            sets.reduce(
              (acc, set) => {
                const name = set.exercise_name || t.sessionDetail.unknownExercise;
                if (!acc.has(name)) {
                  acc.set(name, []);
                }
                acc.get(name)!.push(set);
                return acc;
              },
              new Map<string, typeof sets>()
            )
          ).map(([exerciseName, exerciseSets]) => (
            <div key={exerciseName} className="card">
              {/* Exercise name as link (if exercise_id is available) */}
              {exerciseSets[0].exercise_id ? (
                <Link
                  to={`/exercises/${exerciseSets[0].exercise_id}/progress`}
                  style={{
                    textDecoration: "none",
                    color: "var(--accent)",
                    fontWeight: "bold",
                    fontSize: "16px",
                    marginBottom: "8px",
                    display: "inline-block",
                  }}
                >
                  {exerciseName}
                </Link>
              ) : (
                <div
                  style={{
                    color: "var(--accent)",
                    fontWeight: "bold",
                    fontSize: "16px",
                    marginBottom: "8px",
                  }}
                >
                  {exerciseName}
                </div>
              )}

              {/* Sets list */}
              <div style={{ display: "grid", gap: "8px" }}>
                {exerciseSets
                  .sort((a, b) => a.set_number - b.set_number)
                  .map((set) => (
                    <div
                      key={set.id}
                      style={{
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        padding: "8px 12px",
                        borderRadius: "16px",
                        fontSize: "14px",
                      }}
                    >
                      <div style={{ fontWeight: "500" }}>
                        {t.sessionDetail.setLabel(set.set_number, set.weight, set.reps, set.duration_seconds)}
                      </div>
                      {set.notes && (
                        <div style={{ fontSize: "13px", color: "var(--text)", fontStyle: "italic", marginTop: "4px" }}>
                          {set.notes}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>{t.sessionDetail.noExercises}</p>
        </div>
      )}
    </div>
  );
};
