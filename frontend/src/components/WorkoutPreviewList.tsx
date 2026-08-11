import React from "react";
import { useLanguage } from "../contexts/LanguageContext";

export interface WorkoutPreviewExercise {
  exercise_name?: string;
  target_sets: number | null;
}

interface WorkoutPreviewListProps {
  title: string;
  exercises: WorkoutPreviewExercise[];
}

/**
 * A read-only numbered list of a day's exercises (name + set count only, no reps/
 * weight) shown before starting a workout. Shared between SessionSetupPage (own
 * plans) and ShareWorkoutStarter (via a shared plan) - both already provide
 * exercises in this exact shape.
 */
export const WorkoutPreviewList: React.FC<WorkoutPreviewListProps> = ({ title, exercises }) => {
  const { t } = useLanguage();

  if (exercises.length === 0) {
    return (
      <div className="card">
        <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "var(--text-h)" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>{t.workoutPreview.noExercises}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "var(--text-h)" }}>{title}</h3>
      {exercises.map((exercise, idx) => (
        <div
          key={idx}
          className="field-group"
          style={{
            justifyContent: "space-between",
            padding: "10px 0",
            borderBottom: idx < exercises.length - 1 ? "1px solid var(--border)" : "none",
          }}
        >
          <div className="field-group" style={{ gap: "12px" }}>
            <div className="icon-badge">{idx + 1}</div>
            <p className="field-group-value" style={{ margin: 0 }}>
              {exercise.exercise_name || t.workoutPreview.exerciseFallback}
            </p>
          </div>
          {exercise.target_sets !== null && (
            <span style={{ fontSize: "14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {t.workoutPreview.setsCount(exercise.target_sets)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default WorkoutPreviewList;
