import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getWorkoutPlanDetail,
  updateWorkoutPlan,
  createDay,
  updateDay,
  deleteDay,
  addExerciseToDay,
  removeExerciseFromDay,
  reorderDayExercise,
  type WorkoutPlanDetail,
  type PlanDay,
  type WorkoutExercise,
} from "../../api/workoutPlansApi";
import { exercisesApi } from "../../api/exercisesApi";
import { workoutSessionsApi } from "../../api/workoutSessionsApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Exercise {
  id: number;
  name: string;
}

export default function PlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [planDetail, setPlanDetail] = useState<WorkoutPlanDetail | null>(null);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [startingWorkout, setStartingWorkout] = useState(false);
  const [numDays, setNumDays] = useState("");
  const [creatingDays, setCreatingDays] = useState(false);

  // Day editing state
  const [editingDayId, setEditingDayId] = useState<number | null>(null);
  const [editingDayLabel, setEditingDayLabel] = useState("");
  const [editingDayWeekdays, setEditingDayWeekdays] = useState<string[]>([]);

  // Add exercise to day state
  const [addingExerciseToDay, setAddingExerciseToDay] = useState<number | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [targetSets, setTargetSets] = useState("");
  const [targetReps, setTargetReps] = useState("");
  const [targetWeight, setTargetWeight] = useState("");

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; dayId: number | null }>({
    isOpen: false,
    dayId: null,
  });

  // Remove exercise confirm state
  const [removeExerciseConfirm, setRemoveExerciseConfirm] = useState<{
    isOpen: boolean;
    dayId: number | null;
    exerciseId: number | null;
  }>({ isOpen: false, dayId: null, exerciseId: null });

  const { Toast, showToast } = useToast();

  useEffect(() => {
    loadPlan();
    loadExercises();
  }, [planId]);

  async function loadPlan() {
    try {
      const data = await getWorkoutPlanDetail(Number(planId));
      setPlanDetail(data);
      setEditingName(data.plan.name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadExercises() {
    try {
      const data = await exercisesApi.list();
      setAvailableExercises(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleUpdateName() {
    if (!editingName.trim()) return;

    try {
      await updateWorkoutPlan(Number(planId), editingName);
      setError("");
      showToast("Plan name updated successfully!", "success");
      await loadPlan();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCreateDays(e: React.FormEvent) {
    e.preventDefault();
    if (!numDays || parseInt(numDays) < 1) return;

    setCreatingDays(true);
    try {
      const count = parseInt(numDays);
      for (let i = 1; i <= count; i++) {
        await createDay(Number(planId), `Day ${i}`, []);
      }
      setNumDays("");
      setError("");
      showToast(`Created ${count} days!`, "success");
      await loadPlan();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingDays(false);
    }
  }

  async function handleAddDay() {
    try {
      await createDay(Number(planId), "New Day", []);
      setError("");
      showToast("Day added!", "success");
      await loadPlan();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function startEditDay(day: PlanDay) {
    setEditingDayId(day.id);
    setEditingDayLabel(day.label);
    setEditingDayWeekdays([...day.weekdays]);
  }

  async function saveEditDay() {
    if (!editingDayId || !editingDayLabel.trim()) return;

    try {
      await updateDay(Number(planId), editingDayId, editingDayLabel, editingDayWeekdays);
      setEditingDayId(null);
      setEditingDayLabel("");
      setEditingDayWeekdays([]);
      setError("");
      showToast("Day updated!", "success");
      await loadPlan();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError(err.response?.data?.error || "Conflict updating day");
      } else {
        setError((err as Error).message);
      }
    }
  }

  function toggleWeekday(weekday: string) {
    setEditingDayWeekdays((prev) =>
      prev.includes(weekday) ? prev.filter((w) => w !== weekday) : [...prev, weekday]
    );
  }

  async function confirmDeleteDay() {
    const dayId = deleteConfirm.dayId;
    setDeleteConfirm({ isOpen: false, dayId: null });

    if (!dayId) return;

    try {
      await deleteDay(Number(planId), dayId);
      setError("");
      showToast("Day deleted!", "success");
      await loadPlan();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError(err.response?.data?.error || "Cannot delete this day");
      } else {
        setError((err as Error).message);
      }
    }
  }

  async function handleAddExerciseToDay(dayId: number, e: React.FormEvent) {
    e.preventDefault();
    if (!exerciseName.trim()) return;

    try {
      // Find or create the exercise
      const existingExercise = availableExercises.find(
        (ex) => ex.name.toLowerCase() === exerciseName.toLowerCase()
      );

      let exerciseId: number;
      if (existingExercise) {
        exerciseId = existingExercise.id;
      } else {
        const newExercise = await exercisesApi.create(exerciseName);
        exerciseId = newExercise.id;
        setAvailableExercises([...availableExercises, newExercise]);
      }

      const sets = targetSets ? Number(targetSets) : undefined;
      const reps = targetReps ? Number(targetReps) : undefined;
      const weight = targetWeight ? Number(targetWeight) : undefined;

      await addExerciseToDay(Number(planId), dayId, exerciseId, sets, reps, weight);
      setExerciseName("");
      setTargetSets("");
      setTargetReps("");
      setTargetWeight("");
      setAddingExerciseToDay(null);
      setError("");
      showToast("Exercise added to day!", "success");
      await loadPlan();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function confirmRemoveExercise() {
    const { dayId, exerciseId } = removeExerciseConfirm;
    setRemoveExerciseConfirm({ isOpen: false, dayId: null, exerciseId: null });

    if (!dayId || !exerciseId) return;

    try {
      await removeExerciseFromDay(Number(planId), dayId, exerciseId);
      setError("");
      showToast("Exercise removed!", "success");
      await loadPlan();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleReorderExercise(dayId: number, exerciseId: number, direction: "up" | "down") {
    try {
      await reorderDayExercise(Number(planId), dayId, exerciseId, direction);
      await loadPlan();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleStartWorkout(dayId: number, dayLabel: string) {
    setStartingWorkout(true);
    try {
      const response = await workoutSessionsApi.startWorkout(Number(planId), dayId);
      navigate(`/workout-sessions/${response.session_id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start workout");
      setStartingWorkout(false);
    }
  }

  const buildTargetLine = (we: WorkoutExercise): string | null => {
    const parts: string[] = [];
    if (we.target_sets !== null) parts.push(`${we.target_sets} sets`);
    if (we.target_reps !== null) parts.push(`${we.target_reps} reps`);
    if (we.target_weight !== null) parts.push(`${we.target_weight} lbs`);
    if (parts.length === 0) return null;
    return "Target: " + parts.join(" × ");
  };

  if (loading) return <div className="loading">Loading plan details...</div>;
  if (!planDetail) return <div className="empty-state"><p>Plan not found</p></div>;

  const showZeroDaysState = planDetail.days.length === 0;

  return (
    <div className="page-container">
      <div style={{ marginBottom: "20px" }}>
        <button onClick={() => navigate("/workout-plans")} className="btn btn-secondary">
          ← Back
        </button>
      </div>

      {/* Update plan name */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="input-field"
            style={{ flex: 1 }}
          />
          <button onClick={handleUpdateName} className="btn btn-primary">
            Update Name
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          className="error-message"
        >
          <span>{error}</span>
          <button
            onClick={() => setError("")}
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

      {/* Zero days state */}
      {showZeroDaysState ? (
        <div className="empty-state">
          <p style={{ marginBottom: "20px" }}>No days added yet. Create some days to get started!</p>
          <form onSubmit={handleCreateDays} style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <input
              type="number"
              min="1"
              value={numDays}
              onChange={(e) => setNumDays(e.target.value)}
              placeholder="Number of days"
              className="input-field"
              style={{ width: "150px" }}
            />
            <button type="submit" className="btn btn-primary" disabled={creatingDays}>
              {creatingDays ? "Creating..." : "Create Days"}
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Day boxes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "20px" }}>
            {planDetail.days.map((day) => (
              <div key={day.id} className="card">
                {/* Day Label and Weekday Toggles */}
                {editingDayId === day.id ? (
                  <>
                    <input
                      type="text"
                      value={editingDayLabel}
                      onChange={(e) => setEditingDayLabel(e.target.value)}
                      className="input-field"
                      style={{ marginBottom: "10px" }}
                    />
                    <div style={{ marginBottom: "10px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {WEEKDAYS.map((weekday) => (
                        <button
                          key={weekday}
                          onClick={() => toggleWeekday(weekday)}
                          className="btn"
                          style={{
                            backgroundColor: editingDayWeekdays.includes(weekday) ? "#007bff" : "var(--border)",
                            color: editingDayWeekdays.includes(weekday) ? "white" : "var(--text-h)",
                            fontSize: "12px",
                            padding: "6px 10px",
                            flex: "1 1 auto",
                            minWidth: "60px",
                          }}
                          aria-pressed={editingDayWeekdays.includes(weekday)}
                          title={weekday}
                        >
                          {weekday.substring(0, 3)}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                      <button onClick={saveEditDay} className="btn btn-primary" style={{ flex: 1 }}>
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingDayId(null);
                          setEditingDayLabel("");
                          setEditingDayWeekdays([]);
                        }}
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "10px",
                        gap: "10px",
                      }}
                    >
                      <h3 style={{ margin: 0, flex: 1 }}>{day.label}</h3>
                      <button
                        onClick={() => startEditDay(day)}
                        className="btn"
                        style={{ fontSize: "12px", padding: "4px 8px" }}
                      >
                        Edit
                      </button>
                    </div>

                    {/* Weekday Display */}
                    {day.weekdays.length > 0 && (
                      <div style={{ marginBottom: "12px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {day.weekdays.map((weekday) => (
                          <span
                            key={weekday}
                            style={{
                              backgroundColor: "var(--accent-bg)",
                              color: "var(--accent)",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                            }}
                          >
                            {weekday.substring(0, 3)}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Exercises List */}
                {day.exercises.length > 0 ? (
                  <div style={{ marginBottom: "12px" }}>
                    {day.exercises.map((we) => {
                      const targetLine = buildTargetLine(we);
                      return (
                        <div
                          key={we.id}
                          style={{
                            backgroundColor: "white",
                            border: "1px solid var(--border)",
                            padding: "8px",
                            borderRadius: "4px",
                            marginBottom: "8px",
                            display: "flex",
                            gap: "8px",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: "0" }}>
                            <div style={{ fontWeight: "bold" }}>
                              {we.order_number}. {we.exercise_name || `Exercise ${we.exercise_id}`}
                            </div>
                            {targetLine && (
                              <div style={{ color: "var(--text)", fontSize: "12px" }}>{targetLine}</div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button
                              onClick={() => handleReorderExercise(day.id, we.id, "up")}
                              disabled={we.order_number === 1}
                              className="btn"
                              style={{ fontSize: "12px", padding: "4px 6px" }}
                              aria-label="Move exercise up"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => handleReorderExercise(day.id, we.id, "down")}
                              disabled={we.order_number === day.exercises.length}
                              className="btn"
                              style={{ fontSize: "12px", padding: "4px 6px" }}
                              aria-label="Move exercise down"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => setRemoveExerciseConfirm({ isOpen: true, dayId: day.id, exerciseId: we.id })}
                              className="btn btn-danger"
                              style={{ fontSize: "12px", padding: "4px 6px" }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: "var(--text)", fontSize: "14px", marginBottom: "12px" }}>No exercises</div>
                )}

                {/* Add Exercise Form */}
                {addingExerciseToDay === day.id ? (
                  <form onSubmit={(e) => handleAddExerciseToDay(day.id, e)} style={{ marginBottom: "12px" }}>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <input
                        type="text"
                        value={exerciseName}
                        onChange={(e) => setExerciseName(e.target.value)}
                        placeholder="Exercise name"
                        className="input-field"
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                        <input
                          type="number"
                          value={targetSets}
                          onChange={(e) => setTargetSets(e.target.value)}
                          placeholder="Sets"
                          className="input-field"
                        />
                        <input
                          type="number"
                          value={targetReps}
                          onChange={(e) => setTargetReps(e.target.value)}
                          placeholder="Reps"
                          className="input-field"
                        />
                        <input
                          type="number"
                          step="0.5"
                          value={targetWeight}
                          onChange={(e) => setTargetWeight(e.target.value)}
                          placeholder="Weight"
                          className="input-field"
                        />
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingExerciseToDay(null);
                            setExerciseName("");
                            setTargetSets("");
                            setTargetReps("");
                            setTargetWeight("");
                          }}
                          className="btn btn-secondary"
                          style={{ flex: 1 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingExerciseToDay(day.id)}
                    className="btn"
                    style={{ width: "100%", marginBottom: "12px" }}
                  >
                    + Add Exercise
                  </button>
                )}

                {/* Start Workout Button */}
                <button
                  onClick={() => handleStartWorkout(day.id, day.label)}
                  disabled={startingWorkout}
                  className="btn btn-success"
                  style={{ width: "100%", marginBottom: "12px" }}
                >
                  Start {day.label}
                </button>

                {/* Delete Day Button */}
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, dayId: day.id })}
                  className="btn btn-danger"
                  style={{ width: "100%" }}
                >
                  Delete Day
                </button>
              </div>
            ))}
          </div>

          {/* Add Day Button */}
          <button onClick={handleAddDay} className="btn btn-primary" style={{ marginBottom: "20px" }}>
            + Add Day
          </button>
        </>
      )}

      {/* Delete Day Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Day"
        message="Are you sure you want to delete this day?"
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmDeleteDay}
        onCancel={() => setDeleteConfirm({ isOpen: false, dayId: null })}
      />

      {/* Remove Exercise Confirmation */}
      <ConfirmDialog
        isOpen={removeExerciseConfirm.isOpen}
        title="Remove Exercise"
        message="Are you sure you want to remove this exercise from the day?"
        confirmText="Remove"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmRemoveExercise}
        onCancel={() => setRemoveExerciseConfirm({ isOpen: false, dayId: null, exerciseId: null })}
      />

      {Toast}
    </div>
  );
}
