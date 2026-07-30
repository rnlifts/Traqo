import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { WorkoutSet, WorkoutSession } from "../../api/workoutSessionsApi";
import { workoutSessionsApi } from "../../api/workoutSessionsApi";
import type { PreviousPerformanceResponse } from "../../api/workoutPlansApi";
import { updateWorkoutPlan, addExerciseToDay, updateExerciseInDay } from "../../api/workoutPlansApi";
import { exercisesApi } from "../../api/exercisesApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { useUnsavedChanges } from "../../contexts/UnsavedChangesContext";
import { DurationInput } from "../../components/DurationInput";
import { secondsToHMS } from "../../utils/duration";

interface Exercise {
  id: number;
  name: string;
  logging_type: string;
}

interface WorkoutExercise {
  id: number;
  plan_day_id: number;
  exercise_id: number;
  order_number: number;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: number | null;
  target_duration_seconds: number | null;
  has_reps: boolean;
  has_weight: boolean;
  has_duration: boolean;
  set_targets: { set_number: number; target_reps: string | null; target_weight: number | null; target_duration_seconds: number | null }[];
  notes?: string;
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
  dayLabel?: string;
  isQuickStart?: boolean;
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
  dayLabel = "Workout",
  isQuickStart = false,
  onPlanDetailRefresh,
}) => {
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const navigate = useNavigate();
  const [loggedSets, setLoggedSets] = useState<WorkoutSet[]>(initialSets);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishConfirm, setFinishConfirm] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);

  // Exit confirmation state
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  // Rename plan state
  const [isRenamingPlan, setIsRenamingPlan] = useState(false);
  const [editingPlanName, setEditingPlanName] = useState(planName);
  const [renamingPlan, setRenamingPlan] = useState(false);

  // Add exercise state
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [addExerciseName, setAddExerciseName] = useState("");
  const [addingExercise, setAddingExercise] = useState(false);

  // Rest timer state
  const [restDuration, setRestDuration] = useState(60); // in seconds
  const [restTimeRemaining, setRestTimeRemaining] = useState(0); // 0 = not running
  const [restStartTime, setRestStartTime] = useState<number | null>(null);

  // Set logging panel state
  const [activePanelExerciseId, setActivePanelExerciseId] = useState<number | null>(null);
  const [activePanelSetNumber, setActivePanelSetNumber] = useState<number | null>(null);
  const [panelWeight, setPanelWeight] = useState("");
  const [panelReps, setPanelReps] = useState("");
  const [panelDuration, setPanelDuration] = useState<number | null>(null);
  const [panelNotes, setPanelNotes] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const { Toast, showToast } = useToast();

  // Guard against unsaved changes when navigating away from active workout
  useEffect(() => {
    setHasUnsavedChanges(true);
    return () => setHasUnsavedChanges(false);
  }, [setHasUnsavedChanges]);

  // Clear the unsaved changes flag when workout is finished
  useEffect(() => {
    if (workoutFinished) {
      setHasUnsavedChanges(false);
    }
  }, [workoutFinished, setHasUnsavedChanges]);

  // Build exercise name lookup
  const exerciseNames: Record<number, string> = {};
  availableExercises.forEach((ex) => {
    exerciseNames[ex.id] = ex.name;
  });

  // Rest timer effect
  useEffect(() => {
    if (restTimeRemaining <= 0) {
      setRestStartTime(null);
      return;
    }

    const interval = setInterval(() => {
      setRestTimeRemaining((_) => {
        const elapsed = restStartTime ? Math.floor((Date.now() - restStartTime) / 1000) : 0;
        const remaining = restDuration - elapsed;
        return remaining > 0 ? remaining : 0;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [restTimeRemaining, restDuration, restStartTime]);

  // Start rest timer automatically after logging a set
  const startRestTimer = () => {
    setRestTimeRemaining(restDuration);
    setRestStartTime(Date.now());
  };

  const skipRest = () => {
    setRestTimeRemaining(0);
    setRestStartTime(null);
  };

  const addTimeToRest = () => {
    if (restTimeRemaining > 0) {
      // Increase the total duration by 15 seconds
      // The effect will recalculate remaining as restDuration - elapsed
      setRestDuration(restDuration + 15);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPreviousPerformanceForExercise = (workoutExerciseId: number) => {
    if (!previousPerformance || !previousPerformance.exercises) return null;
    return previousPerformance.exercises.find((ex) => ex.workout_exercise_id === workoutExerciseId) || null;
  };

  const getPreviousSetData = (workoutExerciseId: number, setNumber: number) => {
    const prevExercise = getPreviousPerformanceForExercise(workoutExerciseId);
    if (!prevExercise) return null;
    return prevExercise.sets.find((s) => s.set_number === setNumber) || null;
  };

  const buildTargetLine = (we: WorkoutExercise, setNumber: number = 1): string | null => {
    const parts: string[] = [];
    if (we.target_sets !== null) parts.push(`${we.target_sets} sets`);

    // Look up per-set override for this set
    const setOverride = we.set_targets?.find((st) => st.set_number === setNumber);

    // Gate by has_* flags and use per-set override with fallback to main row
    if (we.has_reps) {
      const reps = setOverride?.target_reps ?? we.target_reps;
      if (reps !== null) parts.push(`${reps} reps`);
    }
    if (we.has_weight) {
      const weight = setOverride?.target_weight ?? we.target_weight;
      if (weight !== null) parts.push(`${weight} lbs`);
    }
    if (we.has_duration) {
      const durationSeconds = setOverride?.target_duration_seconds ?? we.target_duration_seconds;
      if (durationSeconds !== null) {
        const hms = secondsToHMS(durationSeconds);
        const durationParts: string[] = [];
        if (hms.h > 0) durationParts.push(`${hms.h}h`);
        if (hms.m > 0) durationParts.push(`${hms.m}m`);
        if (hms.s > 0) durationParts.push(`${hms.s}s`);
        if (durationParts.length > 0) parts.push(durationParts.join(" "));
      }
    }

    if (parts.length === 0) return null;

    return "Target: " + parts.join(" × ");
  };

  const formatSessionDate = (dateString: string): string => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const buildPreviousPerformanceLine = (workoutExerciseId: number): string | null => {
    const prevExercise = getPreviousPerformanceForExercise(workoutExerciseId);
    if (!prevExercise || prevExercise.sets.length === 0) return null;

    const setsFormatted = prevExercise.sets
      .map((s) => {
        let format = '';
        if (s.weight !== null && s.reps !== null) {
          format = `${s.weight} lbs × ${s.reps}`;
        } else if (s.weight !== null) {
          format = `${s.weight} lbs`;
        } else if (s.reps !== null) {
          format = `${s.reps} reps`;
        } else if (s.duration_seconds !== null) {
          format = `${s.duration_seconds}s`;
        }
        return format;
      })
      .filter((f) => f !== '')
      .join(", ");

    if (!previousPerformance?.session_date) return null;
    const dateLabel = formatSessionDate(previousPerformance.session_date);
    return `Last time (${dateLabel}): ${setsFormatted}`;
  };

  // Get the pip count for an exercise
  const getPipCount = (we: WorkoutExercise): number => {
    return we.target_sets ?? 3;
  };

  // Get logged sets for a plan-exercise instance, sorted by set number
  const getExerciseSets = (workoutExerciseId: number): WorkoutSet[] => {
    return loggedSets
      .filter((s) => s.workout_exercise_id === workoutExerciseId)
      .sort((a, b) => a.set_number - b.set_number);
  };

  // Open set logging panel
  const openSetPanel = (workoutExerciseId: number, setNumber: number) => {
    // Close any existing panel
    if (activePanelExerciseId === workoutExerciseId && activePanelSetNumber === setNumber) {
      // Toggle off if clicking the same pip
      setActivePanelExerciseId(null);
      setActivePanelSetNumber(null);
      setError(null);
      return;
    }

    setActivePanelExerciseId(workoutExerciseId);
    setActivePanelSetNumber(setNumber);
    setShowNoteInput(false);
    setError(null);

    // Check if this set is already logged
    const existingSet = loggedSets.find(
      (s) => s.workout_exercise_id === workoutExerciseId && s.set_number === setNumber
    );

    if (existingSet) {
      // Pre-fill with existing set data
      setPanelWeight((existingSet.weight ?? "").toString());
      setPanelReps((existingSet.reps ?? "").toString());
      setPanelDuration(existingSet.duration_seconds ?? null);
      setPanelNotes(existingSet.notes || "");
    } else {
      // Pre-fill with target or previous performance data
      const workoutExercise = planExercises.find((we) => we.id === workoutExerciseId);

      // Check for per-set override first
      const perSetOverride = workoutExercise?.set_targets?.find((st) => st.set_number === setNumber);

      // Weight: per-set override > uniform target > previous performance
      if (perSetOverride?.target_weight) {
        setPanelWeight(perSetOverride.target_weight.toString());
      } else if (workoutExercise?.target_weight) {
        setPanelWeight(workoutExercise.target_weight.toString());
      } else {
        const prevSet = getPreviousSetData(workoutExerciseId, setNumber);
        if (prevSet?.weight) {
          setPanelWeight(prevSet.weight.toString());
        } else {
          setPanelWeight("");
        }
      }

      // Reps: per-set override > uniform target > previous performance
      if (perSetOverride?.target_reps) {
        setPanelReps(perSetOverride.target_reps);
      } else if (workoutExercise?.target_reps) {
        setPanelReps(workoutExercise.target_reps);
      } else {
        const prevSet = getPreviousSetData(workoutExerciseId, setNumber);
        if (prevSet?.reps) {
          setPanelReps(prevSet.reps.toString());
        } else {
          setPanelReps("");
        }
      }

      // Duration: per-set override > uniform target > previous performance
      if (perSetOverride?.target_duration_seconds) {
        setPanelDuration(perSetOverride.target_duration_seconds);
      } else if (workoutExercise?.target_duration_seconds) {
        setPanelDuration(workoutExercise.target_duration_seconds);
      } else {
        const prevSet = getPreviousSetData(workoutExerciseId, setNumber);
        setPanelDuration(prevSet?.duration_seconds ?? null);
      }

      setPanelNotes("");
    }
  };

  // Close set logging panel
  const closeSetPanel = () => {
    setActivePanelExerciseId(null);
    setActivePanelSetNumber(null);
    setPanelWeight("");
    setPanelReps("");
    setPanelDuration(null);
    setPanelNotes("");
    setShowNoteInput(false);
    setError(null);
  };

  // Log or update a set
  const handleLogSet = async () => {
    if (!activePanelExerciseId || activePanelSetNumber === null) return;

    // Permissive validation: at least one of weight/reps/duration must be provided
    const hasWeight = panelWeight && panelWeight.trim() !== "";
    const hasReps = panelReps && panelReps.trim() !== "";
    const hasDuration = panelDuration !== null && panelDuration > 0;

    if (!hasWeight && !hasReps && !hasDuration) {
      setError("At least one of weight, reps, or duration is required");
      return;
    }

    setLoading(true);
    try {
      // Prepare values from whatever the panel currently contains
      const weight = hasWeight ? Number(panelWeight) : null;
      const reps = hasReps ? Number(panelReps) : null;
      const duration = hasDuration ? panelDuration : null;

      const newSet = await workoutSessionsApi.addWorkoutSet(
        session.id,
        activePanelExerciseId,
        activePanelSetNumber,
        weight,
        reps,
        duration,
        panelNotes
      );

      // Update or add the set
      setLoggedSets((prevSets) => {
        const existing = prevSets.find(
          (s) => s.workout_exercise_id === activePanelExerciseId && s.set_number === activePanelSetNumber
        );
        if (existing) {
          // Update existing set
          return prevSets.map((s) =>
            s.workout_exercise_id === activePanelExerciseId && s.set_number === activePanelSetNumber
              ? newSet
              : s
          );
        } else {
          // Add new set
          return [...prevSets, newSet];
        }
      });

      closeSetPanel();
      startRestTimer();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to log set");
    } finally {
      setLoading(false);
    }
  };

  // Delete a set
  const handleDeleteSet = async () => {
    if (!activePanelExerciseId || activePanelSetNumber === null) return;

    const existingSet = loggedSets.find(
      (s) => s.workout_exercise_id === activePanelExerciseId && s.set_number === activePanelSetNumber
    );

    if (!existingSet) return;

    setLoading(true);
    try {
      await workoutSessionsApi.deleteWorkoutSet(session.id, existingSet.id);

      setLoggedSets((prev) =>
        prev.filter(
          (s) =>
            !(
              s.workout_exercise_id === activePanelExerciseId && s.set_number === activePanelSetNumber
            )
        )
      );

      closeSetPanel();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete set");
    } finally {
      setLoading(false);
    }
  };

  // Handle save & exit — session stays unresolved, sets already persisted
  const handleSaveAndExit = () => {
    setHasUnsavedChanges(false);
    setShowExitConfirm(false);
    navigate("/dashboard");
  };

  // Handle discard — delete the session and its sets
  const handleDiscard = async () => {
    try {
      await workoutSessionsApi.discardSession(session.id);
      setShowExitConfirm(false);
      setDiscardConfirm(false);
      showToast("Workout discarded.", "success");
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to discard workout");
    }
  };

  const handleFinishWorkout = async () => {
    setFinishConfirm(false);
    setFinishing(true);
    setError(null);
    try {
      await workoutSessionsApi.finishWorkout(session.id);
      showToast("Workout finished!", "success");
      setWorkoutFinished(true);
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

      if (onPlanDetailRefresh) {
        await onPlanDetailRefresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add exercise");
    } finally {
      setAddingExercise(false);
    }
  };

  // Calculate progress
  const totalExercises = planExercises.length;
  const exercisesWithAllSetsDone = planExercises.filter((we) => {
    const pipCount = getPipCount(we);
    const exerciseSets = getExerciseSets(we.id);
    return exerciseSets.length >= pipCount;
  }).length;
  const progressPercent = totalExercises > 0 ? (exercisesWithAllSetsDone / totalExercises) * 100 : 0;

  // Calculate set counts
  const totalSets = planExercises.reduce((sum, we) => sum + getPipCount(we), 0);
  const doneSets = loggedSets.length;

  if (workoutFinished) {
    return (
      <div className="page-container">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: "20px",
          }}
        >
          <h2 style={{ fontSize: "32px", margin: "20px 0" }}>Workout complete!</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              fontSize: "18px",
              marginBottom: "20px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "var(--text)" }}>
                Exercises completed
              </p>
              <p style={{ margin: 0, fontSize: "28px", fontWeight: "bold" }}>
                {exercisesWithAllSetsDone}/{totalExercises}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "var(--text)" }}>
                Sets logged
              </p>
              <p style={{ margin: 0, fontSize: "28px", fontWeight: "bold" }}>
                {doneSets}/{totalSets}
              </p>
            </div>
          </div>
          <button
            onClick={() => onFinish()}
            className="btn btn-primary"
            style={{ padding: "12px 24px", fontSize: "16px" }}
          >
            Done
          </button>
        </div>
        {Toast}
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        {/* Exit link + Day label */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 4px 0",
                fontSize: "12px",
                color: "var(--text)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {planName}
            </p>
            <h1 style={{ margin: 0, fontSize: "28px" }}>{dayLabel}</h1>
          </div>
          <button
            onClick={() => setShowExitConfirm(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              fontSize: "16px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
            aria-label="Exit workout"
          >
            ‹ Exit
          </button>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: "var(--border)",
            borderRadius: "4px",
            overflow: "hidden",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              backgroundColor: "var(--success)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Exit confirmation banner */}
      {showExitConfirm && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--danger-soft)",
            border: "1px solid var(--danger)",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "16px",
            gap: "12px",
          }}
        >
          <span style={{ color: "var(--danger)", fontSize: "14px", flex: 1, fontWeight: "500" }}>
            Save your progress and exit, or discard this workout?
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setShowExitConfirm(false)}
              className="btn btn-secondary"
              style={{ padding: "8px 12px", fontSize: "13px" }}
            >
              Keep going
            </button>
            <button
              onClick={handleSaveAndExit}
              className="btn btn-primary"
              style={{ padding: "8px 12px", fontSize: "13px" }}
            >
              Save & Exit
            </button>
            <button
              onClick={() => setDiscardConfirm(true)}
              className="btn btn-danger"
              style={{ padding: "8px 12px", fontSize: "13px" }}
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
        onConfirm={handleDiscard}
        onCancel={() => setDiscardConfirm(false)}
      />

      {/* Rest timer widget */}
      {restTimeRemaining > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            backgroundColor: "var(--success-bg)",
            border: "1px solid var(--success-border)",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--success)" }}>
            {formatTime(restTimeRemaining)}
          </div>
          <button
            onClick={addTimeToRest}
            className="btn"
            style={{
              padding: "8px 12px",
              fontSize: "13px",
              backgroundColor: "var(--success)",
              color: "white",
            }}
          >
            +15s
          </button>
          <button
            onClick={skipRest}
            className="btn btn-secondary"
            style={{ padding: "8px 12px", fontSize: "13px" }}
          >
            Skip rest
          </button>
        </div>
      )}

      {/* Rest timer idle state */}
      {restTimeRemaining === 0 && (
        <div
          style={{
            backgroundColor: "var(--code-bg)",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "16px",
            fontSize: "13px",
            color: "var(--text)",
          }}
        >
          <p style={{ margin: 0, marginBottom: "8px" }}>Rest timer starts automatically after each set</p>
          <div style={{ display: "flex", gap: "8px" }}>
            {[30, 60, 90, 120].map((duration) => (
              <button
                key={duration}
                onClick={() => setRestDuration(duration)}
                className={`btn ${restDuration === duration ? "btn-primary" : "btn-secondary"}`}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                }}
              >
                {duration}s
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error message — only show at top if no panel is open (inline errors show in the panel instead) */}
      {error && activePanelExerciseId === null && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          className="error-message"
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              color: "#721c24",
              fontSize: "20px",
              cursor: "pointer",
              padding: "0 0 0 12px",
              flex: "0 0 auto",
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Exercise cards */}
      <div style={{ display: "grid", gap: "20px", marginBottom: "20px" }}>
        {planExercises.length === 0 ? (
          <div className="empty-state">
            <p>No exercises in this plan</p>
          </div>
        ) : (
          planExercises.map((we) => {
            const exerciseName = we.exercise_name || exerciseNames[we.exercise_id] || `Exercise ${we.exercise_id}`;
            const exerciseSets = getExerciseSets(we.id);
            const currentSetNumber = activePanelExerciseId === we.id && activePanelSetNumber !== null ? activePanelSetNumber : 1;
            const targetLine = buildTargetLine(we, currentSetNumber);
            const previousLine = buildPreviousPerformanceLine(we.id);
            const pipCount = getPipCount(we);

            return (
              <div key={we.id} className="card" style={{ padding: "12px" }}>
                {/* Exercise name */}
                <h3 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>{exerciseName}</h3>

                {/* Target line */}
                {targetLine && (
                  <p style={{ margin: "0 0 8px 0", color: "var(--text)", fontSize: "14px" }}>
                    {targetLine}
                  </p>
                )}

                {/* Previous performance line */}
                {previousLine && (
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      color: "var(--text)",
                      fontSize: "13px",
                      fontStyle: "italic",
                    }}
                  >
                    {previousLine}
                  </p>
                )}

                {/* Planning notes */}
                {we.notes && (
                  <p
                    style={{
                      margin: "0 0 12px 0",
                      color: "var(--text)",
                      fontSize: "13px",
                      fontStyle: "italic",
                    }}
                  >
                    {we.notes}
                  </p>
                )}

                {/* Pips row */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  {/* Target pips */}
                  {/* Render pips for all sets (planned + logged extra), with dashed "+" at the end for quick-start */}
                  {Array.from({ length: Math.max(pipCount, exerciseSets.length) }).map((_, i) => {
                    const setNumber = i + 1;
                    const isLogged = exerciseSets.some((s) => s.set_number === setNumber);

                    return (
                      <button
                        key={`pip-${setNumber}`}
                        onClick={() => openSetPanel(we.id, setNumber)}
                        aria-label={
                          isLogged
                            ? (() => {
                                const loggedSet = exerciseSets.find((s) => s.set_number === setNumber);
                                if (!loggedSet) return `Set ${setNumber}, not logged`;
                                let format = '';
                                if (loggedSet.weight !== null && loggedSet.reps !== null) {
                                  format = `${loggedSet.weight} lbs × ${loggedSet.reps} reps`;
                                } else if (loggedSet.weight !== null) {
                                  format = `${loggedSet.weight} lbs`;
                                } else if (loggedSet.reps !== null) {
                                  format = `${loggedSet.reps} reps`;
                                } else if (loggedSet.duration_seconds !== null) {
                                  format = `${loggedSet.duration_seconds}s`;
                                }
                                return `Set ${setNumber}, logged: ${format}, tap to edit`;
                              })()
                            : `Set ${setNumber}, not logged`
                        }
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          border: isLogged ? `2px solid var(--success)` : "2px solid var(--border)",
                          backgroundColor: isLogged ? "var(--success)" : "var(--surface)",
                          color: isLogged ? "var(--surface)" : "var(--ink-primary)",
                          fontSize: "14px",
                          fontWeight: "bold",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        {isLogged ? "✓" : setNumber}
                      </button>
                    );
                  })}

                  {/* Dashed "+" pip for next extra set — quick-start only */}
                  {isQuickStart && (
                    <button
                      onClick={() => openSetPanel(we.id, Math.max(pipCount, exerciseSets.length) + 1)}
                      aria-label={`Add extra set`}
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        border: "2px dashed var(--border)",
                        backgroundColor: "var(--surface)",
                        color: "var(--ink-primary)",
                        fontSize: "20px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                      }}
                    >
                      +
                    </button>
                  )}
                </div>

                {/* Set logging panel */}
                {activePanelExerciseId === we.id && activePanelSetNumber !== null && (
                  <div
                    style={{
                      backgroundColor: "var(--code-bg)",
                      borderRadius: "4px",
                      padding: "12px",
                      marginTop: "12px",
                      borderTop: "2px solid var(--border)",
                    }}
                  >
                    {/* Panel heading */}
                    <p
                      style={{
                        margin: "0 0 12px 0",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "var(--text-h)",
                      }}
                    >
                      Set {activePanelSetNumber}
                    </p>

                    {/* Inline error for this panel */}
                    {error && activePanelExerciseId === we.id && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "12px",
                        }}
                        className="error-message"
                      >
                        <span>{error}</span>
                        <button
                          onClick={() => setError(null)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#721c24",
                            fontSize: "20px",
                            cursor: "pointer",
                            padding: "0 0 0 12px",
                            flex: "0 0 auto",
                          }}
                          aria-label="Dismiss error"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Flag-based inputs with inline configuration for first set */}
                    {(() => {
                      const isConfigurable = isQuickStart && getExerciseSets(we.id).length === 0;
                      const showReps = we.has_reps;
                      const showWeight = we.has_weight;
                      const showDuration = we.has_duration;

                      return (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                          {showWeight ? (
                            <div className="field-cell">
                              <span className="cell-label">Weight (lbs)</span>
                              <div className="field-with-badge">
                                <input
                                  id={`weight-${we.id}-${activePanelSetNumber}`}
                                  type="number"
                                  step="0.5"
                                  value={panelWeight}
                                  onChange={(e) => setPanelWeight(e.target.value)}
                                  placeholder="0"
                                  className="input-field"
                                />
                                {isConfigurable && (
                                  <button
                                    onClick={async () => {
                                      if (!planId || !dayId) return;
                                      try {
                                        await updateExerciseInDay(planId, dayId, we.id, { has_weight: false });
                                        if (onPlanDetailRefresh) await onPlanDetailRefresh();
                                      } catch (err) {
                                        setError((err as Error).message);
                                      }
                                    }}
                                    className="field-remove-badge"
                                    title="Remove weight"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            isConfigurable && (
                              <div className="field-cell">
                                <span className="cell-label">Weight</span>
                                <button
                                  onClick={async () => {
                                    if (!planId || !dayId) return;
                                    try {
                                      await updateExerciseInDay(planId, dayId, we.id, { has_weight: true });
                                      if (onPlanDetailRefresh) await onPlanDetailRefresh();
                                    } catch (err) {
                                      setError((err as Error).message);
                                    }
                                  }}
                                  className="field-restore-chip"
                                >
                                  + Weight
                                </button>
                              </div>
                            )
                          )}
                          {showReps ? (
                            <div className="field-cell">
                              <span className="cell-label">Reps</span>
                              <div className="field-with-badge">
                                <input
                                  id={`reps-${we.id}-${activePanelSetNumber}`}
                                  type="text"
                                  value={panelReps}
                                  onChange={(e) => setPanelReps(e.target.value)}
                                  placeholder="e.g. 10 or 10-12"
                                  className="input-field"
                                />
                                {isConfigurable && (
                                  <button
                                    onClick={async () => {
                                      if (!planId || !dayId) return;
                                      try {
                                        await updateExerciseInDay(planId, dayId, we.id, { has_reps: false });
                                        if (onPlanDetailRefresh) await onPlanDetailRefresh();
                                      } catch (err) {
                                        setError((err as Error).message);
                                      }
                                    }}
                                    className="field-remove-badge"
                                    title="Remove reps"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            isConfigurable && (
                              <div className="field-cell">
                                <span className="cell-label">Reps</span>
                                <button
                                  onClick={async () => {
                                    if (!planId || !dayId) return;
                                    try {
                                      await updateExerciseInDay(planId, dayId, we.id, { has_reps: true });
                                      if (onPlanDetailRefresh) await onPlanDetailRefresh();
                                    } catch (err) {
                                      setError((err as Error).message);
                                    }
                                  }}
                                  className="field-restore-chip"
                                >
                                  + Reps
                                </button>
                              </div>
                            )
                          )}
                          {showDuration ? (
                            <div className="field-cell">
                              <span className="cell-label">Duration</span>
                              <DurationInput
                                value={panelDuration}
                                onChange={setPanelDuration}
                                onRemove={
                                  isConfigurable
                                    ? async () => {
                                        if (!planId || !dayId) return;
                                        try {
                                          await updateExerciseInDay(planId, dayId, we.id, { has_duration: false });
                                          if (onPlanDetailRefresh) await onPlanDetailRefresh();
                                        } catch (err) {
                                          setError((err as Error).message);
                                        }
                                      }
                                    : undefined
                                }
                              />
                            </div>
                          ) : (
                            isConfigurable && (
                              <div className="field-cell">
                                <span className="cell-label">Duration</span>
                                <button
                                  onClick={async () => {
                                    if (!planId || !dayId) return;
                                    try {
                                      await updateExerciseInDay(planId, dayId, we.id, { has_duration: true });
                                      if (onPlanDetailRefresh) await onPlanDetailRefresh();
                                    } catch (err) {
                                      setError((err as Error).message);
                                    }
                                  }}
                                  className="field-restore-chip"
                                >
                                  + Duration
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      );
                    })()}

                    {/* Notes toggle */}
                    {!showNoteInput && (
                      <button
                        onClick={() => setShowNoteInput(true)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--accent)",
                          fontSize: "12px",
                          cursor: "pointer",
                          textDecoration: "underline",
                          marginBottom: "12px",
                          padding: 0,
                        }}
                      >
                        + Add a note
                      </button>
                    )}

                    {/* Notes input */}
                    {showNoteInput && (
                      <div style={{ marginBottom: "12px" }}>
                        <input
                          type="text"
                          value={panelNotes}
                          onChange={(e) => setPanelNotes(e.target.value)}
                          placeholder="Optional notes"
                          className="input-field"
                          style={{ padding: "6px 8px", fontSize: "13px" }}
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-start",
                      }}
                    >
                      {/* Check if this is an existing set */}
                      {exerciseSets.some((s) => s.set_number === activePanelSetNumber) ? (
                        <>
                          <button
                            onClick={handleLogSet}
                            disabled={loading}
                            className="btn btn-primary"
                            style={{
                              padding: "6px 12px",
                              fontSize: "13px",
                              opacity: loading ? 0.6 : 1,
                            }}
                          >
                            {loading ? "Saving..." : "Save changes"}
                          </button>
                          <button
                            onClick={handleDeleteSet}
                            disabled={loading}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--danger)",
                              fontSize: "13px",
                              cursor: "pointer",
                              textDecoration: "underline",
                              opacity: loading ? 0.6 : 1,
                            }}
                          >
                            {loading ? "Deleting..." : "Delete set"}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleLogSet}
                          disabled={loading}
                          className="btn btn-success"
                          style={{
                            padding: "6px 12px",
                            fontSize: "13px",
                            opacity: loading ? 0.6 : 1,
                          }}
                        >
                          {loading ? "Logging..." : "✓ Log set"}
                        </button>
                      )}
                      <button
                        onClick={closeSetPanel}
                        disabled={loading}
                        className="btn btn-secondary"
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Plan name editor */}
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "12px", color: "var(--text)", textTransform: "uppercase" }}>Plan name:</span>
        {isRenamingPlan ? (
          <>
            <input
              type="text"
              value={editingPlanName}
              onChange={(e) => setEditingPlanName(e.target.value)}
              className="input-field"
              style={{ flex: 1, margin: 0, padding: "6px 8px", fontSize: "13px" }}
              autoFocus
            />
            <button
              onClick={handleSavePlanName}
              disabled={renamingPlan}
              className="btn btn-primary"
              style={{ padding: "6px 12px", fontSize: "13px" }}
            >
              {renamingPlan ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setIsRenamingPlan(false);
                setEditingPlanName(planName);
              }}
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "13px" }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>{planName}</span>
            <button
              onClick={() => setIsRenamingPlan(true)}
              className="btn"
              style={{ padding: "6px 12px", fontSize: "13px" }}
            >
              Rename
            </button>
          </>
        )}
      </div>

      {/* Add exercise mid-workout — quick-start only */}
      {isQuickStart && planId && dayId && (
        <div style={{ marginBottom: "20px" }}>
          {isAddingExercise ? (
            <div className="card">
              <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Add Exercise</h3>
              <form onSubmit={handleAddExerciseToDay} style={{ display: "grid", gap: "8px" }}>
                <input
                  type="text"
                  value={addExerciseName}
                  onChange={(e) => setAddExerciseName(e.target.value)}
                  placeholder="Exercise name"
                  className="input-field"
                  style={{ padding: "6px 8px", fontSize: "13px" }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="submit"
                    disabled={addingExercise}
                    className="btn btn-primary"
                    style={{ flex: 1, opacity: addingExercise ? 0.6 : 1, padding: "6px 12px", fontSize: "13px" }}
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
                    style={{ flex: 1, padding: "6px 12px", fontSize: "13px" }}
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
              style={{ width: "100%", marginBottom: "12px", padding: "8px 12px" }}
            >
              + Add Exercise
            </button>
          )}
        </div>
      )}

      {/* Finish workout button */}
      <button
        onClick={() => setFinishConfirm(true)}
        disabled={finishing}
        className="btn btn-success"
        style={{ width: "100%", opacity: finishing ? 0.6 : 1, padding: "12px", marginBottom: "20px" }}
      >
        {finishing ? "Finishing..." : "Finish Workout"}
      </button>

      {/* Finish confirmation dialog */}
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
