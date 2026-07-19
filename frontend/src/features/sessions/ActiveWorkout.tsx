import React, { useState } from "react";
import type { WorkoutSet, WorkoutSession } from "../../api/workoutSessionsApi";
import { workoutSessionsApi } from "../../api/workoutSessionsApi";
import type { PreviousPerformanceResponse } from "../../api/workoutPlansApi";
import { updateWorkoutPlan, addExerciseToDay } from "../../api/workoutPlansApi";
import { exercisesApi } from "../../api/exercisesApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

interface Exercise {
  id: number;
  name: string;
}

interface WorkoutExercise {
  id: number;
  plan_day_id: number;
  exercise_id: number;
  order_number: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  exercise_name?: string;
}

interface ActiveWorkoutProps {
  session: WorkoutSession;
  planExercises: WorkoutExercise[];
  availableExercises: Exercise[];
  onFinish: () => void;
  initialSets?: WorkoutSet[];
  previousPerformance?: PreviousPerformanceResponse | null;
  planId?: number;
  dayId?: number;
  planName?: string;
  onPlanDetailRefresh?: () => Promise<void>;
}

export const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({
  session,
  planExercises,
  availableExercises,
  onFinish,
  initialSets = [],
  previousPerformance = null,
  planId,
  dayId,
  planName = "Active Workout",
  onPlanDetailRefresh,
}) => {
  const [loggedSets, setLoggedSets] = useState<WorkoutSet[]>(initialSets);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishConfirm, setFinishConfirm] = useState(false);

  // Rename plan state
  const [isRenamingPlan, setIsRenamingPlan] = useState(false);
  const [editingPlanName, setEditingPlanName] = useState(planName);
  const [renamingPlan, setRenamingPlan] = useState(false);

  // Add exercise state
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [addExerciseName, setAddExerciseName] = useState("");
  const [addingExercise, setAddingExercise] = useState(false);

  // Track form state per exercise
  const [formState, setFormState] = useState<Record<number, { weight: string; reps: string; notes: string }>>({});

  const { Toast, showToast } = useToast();

  // Build exercise name lookup
  const exerciseNames: Record<number, string> = {};
  availableExercises.forEach((ex) => {
    exerciseNames[ex.id] = ex.name;
  });

  const getFormState = (exerciseId: number) => {
    if (!formState[exerciseId]) {
      formState[exerciseId] = { weight: "", reps: "", notes: "" };
    }
    return formState[exerciseId];
  };

  const setFormValue = (exerciseId: number, field: "weight" | "reps" | "notes", value: string) => {
    setFormState((prev) => ({
      ...prev,
      [exerciseId]: {
        ...getFormState(exerciseId),
        [field]: value,
      },
    }));
  };

  const clearFormState = (exerciseId: number) => {
    setFormState((prev) => ({
      ...prev,
      [exerciseId]: { weight: "", reps: "", notes: "" },
    }));
  };

  const buildTargetLine = (we: WorkoutExercise): string | null => {
    const parts: string[] = [];
    if (we.target_sets !== null) parts.push(`${we.target_sets} sets`);
    if (we.target_reps !== null) parts.push(`${we.target_reps} reps`);
    if (we.target_weight !== null) parts.push(`${we.target_weight} lbs`);
    if (parts.length === 0) return null;
    return "Target: " + parts.join(" × ");
  };

  const getPreviousPerformanceForExercise = (exerciseId: number) => {
    if (!previousPerformance || !previousPerformance.exercises) return null;
    return previousPerformance.exercises.find((ex) => ex.exercise_id === exerciseId) || null;
  };

  const formatSessionDate = (dateString: string): string => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const buildPreviousPerformanceLine = (exerciseId: number): string | null => {
    const prevExercise = getPreviousPerformanceForExercise(exerciseId);
    if (!prevExercise || prevExercise.sets.length === 0) return null;

    const setsFormatted = prevExercise.sets
      .map((s) => `${s.weight} lbs × ${s.reps}`)
      .join(", ");

    if (!previousPerformance?.session_date) return null;
    const dateLabel = formatSessionDate(previousPerformance.session_date);
    return `Last time (${dateLabel}): ${setsFormatted}`;
  };

  const handleAddSet = async (exerciseId: number, e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const state = getFormState(exerciseId);
    if (!state.weight || !state.reps) {
      setError("Weight and reps are required");
      return;
    }

    setLoading(true);
    try {
      const newSet = await workoutSessionsApi.addWorkoutSet(
        session.id,
        exerciseId,
        Number(state.weight),
        Number(state.reps),
        state.notes
      );
      setLoggedSets([...loggedSets, newSet]);
      clearFormState(exerciseId);
      setError(null);
      showToast("Set logged successfully!", "success");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add set");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishWorkout = async () => {
    setFinishConfirm(false);
    setFinishing(true);
    setError(null);
    try {
      await workoutSessionsApi.finishWorkout(session.id);
      showToast("Workout finished!", "success");
      onFinish();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to finish workout");
      setFinishing(false);
    }
  };

  const handleSavePlanName = async () => {
    if (!editingPlanName.trim() || !planId) return;

    setRenamingPlan(true);
    try {
      await updateWorkoutPlan(planId, editingPlanName);
      setIsRenamingPlan(false);
      setError(null);
      showToast("Plan name updated!", "success");
      if (onPlanDetailRefresh) {
        await onPlanDetailRefresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update plan name");
    } finally {
      setRenamingPlan(false);
    }
  };

  const handleAddExerciseToDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addExerciseName.trim() || !planId || !dayId) return;

    setAddingExercise(true);
    try {
      // Find or create the exercise
      const existingExercise = availableExercises.find(
        (ex) => ex.name.toLowerCase() === addExerciseName.toLowerCase()
      );

      let exerciseId: number;
      if (existingExercise) {
        exerciseId = existingExercise.id;
      } else {
        const newExercise = await exercisesApi.create(addExerciseName);
        exerciseId = newExercise.id;
      }

      await addExerciseToDay(planId, dayId, exerciseId);

      setAddExerciseName("");
      setIsAddingExercise(false);
      setError(null);
      showToast("Exercise added!", "success");

      // Refresh the plan detail to show the new exercise
      if (onPlanDetailRefresh) {
        await onPlanDetailRefresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add exercise");
    } finally {
      setAddingExercise(false);
    }
  };

  // Group sets by exercise
  const setsByExercise: Record<number, WorkoutSet[]> = {};
  loggedSets.forEach((set) => {
    if (!setsByExercise[set.exercise_id]) {
      setsByExercise[set.exercise_id] = [];
    }
    setsByExercise[set.exercise_id].push(set);
  });

  return (
    <div className="page-container">
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <h2 style={{ margin: 0 }}>Active Workout</h2>
          {isRenamingPlan ? (
            <>
              <input
                type="text"
                value={editingPlanName}
                onChange={(e) => setEditingPlanName(e.target.value)}
                className="input-field"
                style={{ flex: 1, margin: 0 }}
                autoFocus
              />
              <button
                onClick={handleSavePlanName}
                disabled={renamingPlan}
                className="btn btn-primary"
                style={{ padding: "6px 12px", fontSize: "14px" }}
              >
                {renamingPlan ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setIsRenamingPlan(false);
                  setEditingPlanName(planName);
                }}
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: "14px" }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span style={{ fontWeight: "bold", flex: 1 }}>{planName}</span>
              <button
                onClick={() => setIsRenamingPlan(true)}
                className="btn"
                style={{ padding: "6px 12px", fontSize: "14px" }}
              >
                Rename
              </button>
            </>
          )}
        </div>
        <p style={{ color: "var(--text)", margin: 0 }}>
          Started: {new Date(session.started_at).toLocaleTimeString()}
        </p>
      </div>

      {error && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="error-message">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
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
        </div>
      )}

      {/* Exercise Cards */}
      <div style={{ display: "grid", gap: "20px", marginBottom: "20px" }}>
        {planExercises.length === 0 ? (
          <div className="empty-state">
            <p>No exercises in this plan</p>
          </div>
        ) : (
          planExercises.map((we) => {
            const exerciseName = we.exercise_name || exerciseNames[we.exercise_id] || `Exercise ${we.exercise_id}`;
            const sets = setsByExercise[we.exercise_id] || [];
            const targetLine = buildTargetLine(we);
            const state = getFormState(we.exercise_id);

            const previousLine = buildPreviousPerformanceLine(we.exercise_id);

            return (
              <div key={we.exercise_id} className="card">
                {/* Exercise Name */}
                <h3 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>{exerciseName}</h3>

                {/* Target Line */}
                {targetLine && (
                  <p style={{ margin: "0 0 12px 0", color: "var(--text)", fontSize: "14px" }}>
                    {targetLine}
                  </p>
                )}

                {/* Previous Performance Line */}
                {previousLine && (
                  <p className="empty-state" style={{ margin: "0 0 12px 0", color: "var(--text)", fontSize: "13px", fontStyle: "italic" }}>
                    {previousLine}
                  </p>
                )}

                {/* Logged Sets */}
                {sets.length === 0 ? (
                  <div className="empty-state" style={{ padding: "20px 0" }}>
                    <p style={{ margin: 0, fontSize: "14px" }}>No sets logged yet</p>
                  </div>
                ) : (
                  <ul style={{ margin: "0 0 16px 0", paddingLeft: "20px" }}>
                    {sets.map((set) => (
                      <li key={set.id} style={{ marginBottom: "8px", fontSize: "14px" }}>
                        <span style={{ fontWeight: "bold" }}>Set {set.set_number}:</span> {set.weight} lbs × {set.reps}{" "}
                        reps
                        {set.notes && <span style={{ color: "var(--text)" }}> — {set.notes}</span>}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add Set Form */}
                <form onSubmit={(e) => handleAddSet(we.exercise_id, e)} style={{ display: "grid", gap: "10px" }}>
                  <input
                    type="number"
                    step="0.5"
                    value={state.weight}
                    onChange={(e) => setFormValue(we.exercise_id, "weight", e.target.value)}
                    placeholder="Weight"
                    className="input-field"
                  />
                  <input
                    type="number"
                    value={state.reps}
                    onChange={(e) => setFormValue(we.exercise_id, "reps", e.target.value)}
                    placeholder="Reps"
                    className="input-field"
                  />
                  <input
                    type="text"
                    value={state.notes}
                    onChange={(e) => setFormValue(we.exercise_id, "notes", e.target.value)}
                    placeholder="Notes (optional)"
                    className="input-field"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ opacity: loading ? 0.6 : 1 }}
                  >
                    {loading ? "Adding..." : "Add Set"}
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>

      {/* Add Exercise Mid-Workout */}
      {planId && dayId && (
        <div style={{ marginBottom: "20px" }}>
          {isAddingExercise ? (
            <div className="card">
              <h3 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>Add Exercise</h3>
              <form onSubmit={handleAddExerciseToDay} style={{ display: "grid", gap: "10px" }}>
                <input
                  type="text"
                  value={addExerciseName}
                  onChange={(e) => setAddExerciseName(e.target.value)}
                  placeholder="Exercise name"
                  className="input-field"
                  autoFocus
                />
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="submit"
                    disabled={addingExercise}
                    className="btn btn-primary"
                    style={{ flex: 1, opacity: addingExercise ? 0.6 : 1 }}
                  >
                    {addingExercise ? "Adding..." : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingExercise(false);
                      setAddExerciseName("");
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingExercise(true)}
              className="btn"
              style={{ width: "100%", marginBottom: "12px" }}
            >
              + Add Exercise
            </button>
          )}
        </div>
      )}

      {/* Finish Button */}
      <button
        onClick={() => setFinishConfirm(true)}
        disabled={finishing}
        className="btn btn-success"
        style={{ opacity: finishing ? 0.6 : 1, marginBottom: "20px" }}
      >
        {finishing ? "Finishing..." : "Finish Workout"}
      </button>

      {/* Finish Confirmation Dialog */}
      <ConfirmDialog
        isOpen={finishConfirm}
        title="Finish Workout"
        message="Are you sure you want to finish this workout? You won't be able to add more sets after finishing."
        confirmText="Finish"
        cancelText="Cancel"
        isDangerous={false}
        onConfirm={handleFinishWorkout}
        onCancel={() => setFinishConfirm(false)}
      />

      {Toast}
    </div>
  );
};
