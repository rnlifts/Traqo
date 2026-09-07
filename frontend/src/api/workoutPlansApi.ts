import client from "./client";

// Plan names (e.g. "Beginner Plan", "Weight Loss Plan") are a short title,
// not a paragraph -- mirrors the backend's PLAN_NAME_MAX_LENGTH / _MAX_WORDS
// limits (schemas.py) so typed/generated names never round-trip to a 422.
export const PLAN_NAME_MAX_LENGTH = 60;
export const PLAN_NAME_MAX_WORDS = 8;

// Truncates a plan name to fit within the limits above -- used for names the
// app generates itself (e.g. "<name> (Copy)" when duplicating a plan) rather
// than typed directly, where clamping instead of rejecting keeps the action
// from silently failing on an old plan whose name predates these limits.
export function clampPlanName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, PLAN_NAME_MAX_WORDS);
  return words.join(' ').slice(0, PLAN_NAME_MAX_LENGTH);
}

export interface WorkoutPlan {
  id: number;
  user_id: number;
  name: string;
  unit_type?: 'days' | 'weeks';
  total_units?: number;
  is_quick_start?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
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
  video_url?: string | null;
}

export interface PlanDay {
  id: number;
  label: string;
  order_position: number;
  is_rest?: boolean;
  // Optional nickname (e.g. "Chest Day") shown alongside `label`, not a
  // replacement for it. null/undefined means no nickname set.
  custom_name?: string | null;
  weekdays?: string[];
  exercises: WorkoutExercise[];
  created_at?: string;
  updated_at?: string;
}

export interface PlanWeek {
  week_number: number;
  mode: 'base' | 'linked' | 'custom';
  resolved_week_number?: number;
  days: PlanDay[];
}

export interface WorkoutPlanDetail {
  plan: WorkoutPlan;
  days?: PlanDay[] | null;
  weeks?: PlanWeek[] | null;
}

export interface BuildPlanExercisePayload {
  exercise_id: number;
  target_sets?: number | null;
  target_reps?: string | null;
  target_weight?: number | null;
  target_duration_seconds?: number | null;
  notes?: string;
  has_reps?: boolean;
  has_weight?: boolean;
  has_duration?: boolean;
  set_targets?: { set_number: number; target_reps: string | null; target_weight: number | null; target_duration_seconds: number | null }[];
}

export interface BuildPlanDayPayload {
  label: string;
  is_rest: boolean;
  order_position: number;
  exercises: BuildPlanExercisePayload[];
  // Optional nickname (e.g. "Chest Day") shown alongside `label`, not a
  // replacement for it.
  custom_name?: string | null;
}

export interface BuildPlanWeekPayload {
  week_number: number;
  mode: 'base' | 'linked' | 'custom';
  days?: BuildPlanDayPayload[];
}

export interface BuildPlanPayload {
  name: string;
  unit_type: 'days' | 'weeks';
  total_units: number;
  days?: BuildPlanDayPayload[];
  weeks?: BuildPlanWeekPayload[];
}

export interface PreviousPerformanceSet {
  set_number: number;
  weight: number | null;
  reps: number | null;
  duration_seconds: number | null;
}

export interface PreviousPerformanceExercise {
  workout_exercise_id: number;
  sets: PreviousPerformanceSet[];
}

export interface PreviousPerformanceResponse {
  session_date: string | null;
  exercises: PreviousPerformanceExercise[];
}

function toBuildPlanExercisePayload(ex: WorkoutExercise): BuildPlanExercisePayload {
  return {
    exercise_id: ex.exercise_id,
    target_sets: ex.target_sets,
    target_reps: ex.target_reps,
    target_weight: ex.target_weight,
    target_duration_seconds: ex.target_duration_seconds,
    has_reps: ex.has_reps,
    has_weight: ex.has_weight,
    has_duration: ex.has_duration,
    notes: ex.notes || '',
    set_targets: ex.set_targets.map((st) => ({
      set_number: st.set_number,
      target_reps: st.target_reps,
      target_weight: st.target_weight,
      target_duration_seconds: st.target_duration_seconds,
    })),
  };
}

function toBuildPlanDayPayload(day: PlanDay): BuildPlanDayPayload {
  return {
    label: day.label,
    is_rest: day.is_rest || false,
    order_position: day.order_position,
    exercises: day.exercises.map(toBuildPlanExercisePayload),
    custom_name: day.custom_name || null,
  };
}

/**
 * Reshapes a fetched plan into the same nested payload the bulk-create
 * endpoint (`POST /workout-plans/build`) accepts, so an existing plan can be
 * duplicated into a brand-new, fully independent plan in one call. Linked
 * weeks are preserved as linked (no days of their own) rather than being
 * flattened into a copy of whatever they currently resolve to.
 */
export function toBuildPlanPayload(source: WorkoutPlanDetail, name?: string): BuildPlanPayload {
  const unitType = source.plan.unit_type || 'days';
  // Quick Start plans are created ad-hoc without ever going through the
  // normal create-plan flow, so they can have a null total_units in the DB —
  // the backend requires total_units > 0, so derive it from the actual
  // number of days/weeks being duplicated instead of defaulting to 0.
  const totalUnits =
    source.plan.total_units ||
    (unitType === 'weeks' ? source.weeks?.length : source.days?.length) ||
    1;

  const payload: BuildPlanPayload = {
    name: name ?? source.plan.name,
    unit_type: unitType,
    total_units: totalUnits,
  };

  if (payload.unit_type === 'weeks') {
    payload.weeks = (source.weeks || []).map((week) => ({
      week_number: week.week_number,
      mode: week.mode,
      ...(week.mode !== 'linked' ? { days: week.days.map(toBuildPlanDayPayload) } : {}),
    }));
  } else {
    payload.days = (source.days || []).map(toBuildPlanDayPayload);
  }

  return payload;
}

export const workoutPlansApi = {
  async create(name: string): Promise<WorkoutPlan> {
    const response = await client.post<WorkoutPlan>("/workout-plans", { name });
    return response.data;
  },

  async list(): Promise<WorkoutPlan[]> {
    const response = await client.get<WorkoutPlan[]>("/workout-plans");
    return response.data;
  },

  async getDetail(planId: number): Promise<WorkoutPlanDetail> {
    const response = await client.get<WorkoutPlanDetail>(`/workout-plans/${planId}`);
    return response.data;
  },

  async update(planId: number, name: string): Promise<WorkoutPlan> {
    const response = await client.put<WorkoutPlan>(`/workout-plans/${planId}`, {
      name,
    });
    return response.data;
  },

  async delete(planId: number): Promise<void> {
    await client.delete(`/workout-plans/${planId}`);
  },

  async createDay(planId: number, label: string, weekdays: string[] = []): Promise<PlanDay> {
    const response = await client.post<PlanDay>(
      `/workout-plans/${planId}/days`,
      { label, weekdays }
    );
    return response.data;
  },

  async listDays(planId: number): Promise<PlanDay[]> {
    const response = await client.get<PlanDay[]>(`/workout-plans/${planId}/days`);
    return response.data;
  },

  async updateDay(planId: number, dayId: number, updates: { label?: string; is_rest?: boolean; custom_name?: string; weekdays?: string[] }): Promise<PlanDay> {
    const response = await client.put<PlanDay>(
      `/workout-plans/${planId}/days/${dayId}`,
      updates
    );
    return response.data;
  },

  async deleteDay(planId: number, dayId: number): Promise<void> {
    await client.delete(`/workout-plans/${planId}/days/${dayId}`);
  },

  async addExerciseToDay(
    planId: number,
    dayId: number,
    exerciseId: number,
    targetSets?: number,
    targetReps?: string | number,
    targetWeight?: number,
    targetDurationSeconds?: number,
    hasReps?: boolean,
    hasWeight?: boolean,
    hasDuration?: boolean
  ): Promise<WorkoutExercise> {
    const body: any = { exercise_id: exerciseId };
    if (targetSets !== undefined) body.target_sets = targetSets;
    if (targetReps !== undefined) body.target_reps = targetReps;
    if (targetWeight !== undefined) body.target_weight = targetWeight;
    if (targetDurationSeconds !== undefined) body.target_duration_seconds = targetDurationSeconds;
    if (hasReps !== undefined) body.has_reps = hasReps;
    if (hasWeight !== undefined) body.has_weight = hasWeight;
    if (hasDuration !== undefined) body.has_duration = hasDuration;

    const response = await client.post<WorkoutExercise>(
      `/workout-plans/${planId}/days/${dayId}/exercises`,
      body
    );
    return response.data;
  },

  async removeExerciseFromDay(planId: number, dayId: number, workoutExerciseId: number): Promise<void> {
    await client.delete(`/workout-plans/${planId}/days/${dayId}/exercises/${workoutExerciseId}`);
  },

  async reorderDayExercise(
    planId: number,
    dayId: number,
    workoutExerciseId: number,
    direction: "up" | "down"
  ): Promise<WorkoutExercise> {
    const response = await client.put<WorkoutExercise>(
      `/workout-plans/${planId}/days/${dayId}/exercises/${workoutExerciseId}/move`,
      { direction }
    );
    return response.data;
  },

  async getPreviousPerformance(
    planId: number,
    dayId: number,
    excludeSessionId?: number
  ): Promise<PreviousPerformanceResponse> {
    const params = new URLSearchParams();
    if (excludeSessionId !== undefined) {
      params.append("exclude_session_id", String(excludeSessionId));
    }
    const queryString = params.toString();
    const url = `/workout-plans/${planId}/days/${dayId}/previous-performance${queryString ? "?" + queryString : ""}`;
    const response = await client.get<PreviousPerformanceResponse>(url);
    return response.data;
  },

  async buildPlan(payload: BuildPlanPayload): Promise<WorkoutPlanDetail> {
    const response = await client.post<WorkoutPlanDetail>("/workout-plans/build", payload);
    return response.data;
  },

  async duplicate(planId: number, newName: string): Promise<WorkoutPlanDetail> {
    const source = await this.getDetail(planId);
    return this.buildPlan(toBuildPlanPayload(source, newName));
  },

  async updateExerciseInDay(
    planId: number,
    dayId: number,
    workoutExerciseId: number,
    updates: { target_sets?: number | null; target_reps?: string | null; target_weight?: number | null; target_duration_seconds?: number | null; has_reps?: boolean; has_weight?: boolean; has_duration?: boolean; notes?: string }
  ): Promise<WorkoutExercise> {
    const response = await client.put<WorkoutExercise>(
      `/workout-plans/${planId}/days/${dayId}/exercises/${workoutExerciseId}`,
      updates
    );
    return response.data;
  },

  async replaceSetTargets(
    planId: number,
    dayId: number,
    workoutExerciseId: number,
    targets: { set_number: number; target_reps: string | null; target_weight: number | null; target_duration_seconds: number | null }[]
  ): Promise<void> {
    await client.put(
      `/workout-plans/${planId}/days/${dayId}/exercises/${workoutExerciseId}/set-targets`,
      targets
    );
  },

  async customizeWeek(planId: number, weekNumber: number): Promise<void> {
    await client.post(`/workout-plans/${planId}/weeks/${weekNumber}/customize`, {});
  },

  async matchPreviousWeek(planId: number, weekNumber: number): Promise<void> {
    await client.post(`/workout-plans/${planId}/weeks/${weekNumber}/match-previous`, {});
  },

  // Legacy plan-level exercise functions (kept for backward compatibility)
  async addExercise(
    planId: number,
    exerciseId: number,
    targetSets?: number,
    targetReps?: number,
    targetWeight?: number
  ): Promise<WorkoutExercise> {
    const body: any = { exercise_id: exerciseId };
    if (targetSets !== undefined) body.target_sets = targetSets;
    if (targetReps !== undefined) body.target_reps = targetReps;
    if (targetWeight !== undefined) body.target_weight = targetWeight;

    const response = await client.post<WorkoutExercise>(
      `/workout-plans/${planId}/exercises`,
      body
    );
    return response.data;
  },

  async removeExercise(planId: number, exerciseId: number): Promise<void> {
    await client.delete(`/workout-plans/${planId}/exercises/${exerciseId}`);
  },

  async reorderExercise(
    planId: number,
    exerciseId: number,
    direction: "up" | "down"
  ): Promise<WorkoutExercise> {
    const response = await client.put<WorkoutExercise>(
      `/workout-plans/${planId}/exercises/${exerciseId}/move`,
      { direction }
    );
    return response.data;
  },
};

// Legacy function-based exports for compatibility
export async function createWorkoutPlan(name: string): Promise<WorkoutPlan> {
  return workoutPlansApi.create(name);
}

export async function listWorkoutPlans(): Promise<WorkoutPlan[]> {
  return workoutPlansApi.list();
}

export async function getWorkoutPlanDetail(
  planId: number
): Promise<WorkoutPlanDetail> {
  return workoutPlansApi.getDetail(planId);
}

export async function updateWorkoutPlan(
  planId: number,
  name: string
): Promise<WorkoutPlan> {
  return workoutPlansApi.update(planId, name);
}

export async function deleteWorkoutPlan(planId: number): Promise<void> {
  return workoutPlansApi.delete(planId);
}

export async function duplicateWorkoutPlan(planId: number, newName: string): Promise<WorkoutPlanDetail> {
  return workoutPlansApi.duplicate(planId, newName);
}

export async function addExerciseToPlan(
  planId: number,
  exerciseId: number,
  targetSets?: number,
  targetReps?: number,
  targetWeight?: number
): Promise<WorkoutExercise> {
  return workoutPlansApi.addExercise(planId, exerciseId, targetSets, targetReps, targetWeight);
}

export async function removeExerciseFromPlan(
  planId: number,
  exerciseId: number
): Promise<void> {
  return workoutPlansApi.removeExercise(planId, exerciseId);
}

export async function reorderExercise(
  planId: number,
  exerciseId: number,
  direction: "up" | "down"
): Promise<WorkoutExercise> {
  return workoutPlansApi.reorderExercise(planId, exerciseId, direction);
}

// Day-related exports
export async function createDay(
  planId: number,
  label: string,
  weekdays: string[] = []
): Promise<PlanDay> {
  return workoutPlansApi.createDay(planId, label, weekdays);
}

export async function listDays(planId: number): Promise<PlanDay[]> {
  return workoutPlansApi.listDays(planId);
}

export async function updateDay(
  planId: number,
  dayId: number,
  updates: { label?: string; is_rest?: boolean; custom_name?: string; weekdays?: string[] }
): Promise<PlanDay> {
  return workoutPlansApi.updateDay(planId, dayId, updates);
}

export async function deleteDay(planId: number, dayId: number): Promise<void> {
  return workoutPlansApi.deleteDay(planId, dayId);
}

export async function addExerciseToDay(
  planId: number,
  dayId: number,
  exerciseId: number,
  targetSets?: number,
  targetReps?: string | number,
  targetWeight?: number,
  targetDurationSeconds?: number,
  hasReps?: boolean,
  hasWeight?: boolean,
  hasDuration?: boolean
): Promise<WorkoutExercise> {
  return workoutPlansApi.addExerciseToDay(planId, dayId, exerciseId, targetSets, targetReps, targetWeight, targetDurationSeconds, hasReps, hasWeight, hasDuration);
}

export async function removeExerciseFromDay(
  planId: number,
  dayId: number,
  workoutExerciseId: number
): Promise<void> {
  return workoutPlansApi.removeExerciseFromDay(planId, dayId, workoutExerciseId);
}

export async function reorderDayExercise(
  planId: number,
  dayId: number,
  workoutExerciseId: number,
  direction: "up" | "down"
): Promise<WorkoutExercise> {
  return workoutPlansApi.reorderDayExercise(planId, dayId, workoutExerciseId, direction);
}

export async function getPreviousPerformance(
  planId: number,
  dayId: number,
  excludeSessionId?: number
): Promise<PreviousPerformanceResponse> {
  return workoutPlansApi.getPreviousPerformance(planId, dayId, excludeSessionId);
}

export async function buildPlan(payload: BuildPlanPayload): Promise<WorkoutPlanDetail> {
  return workoutPlansApi.buildPlan(payload);
}

export async function updateExerciseInDay(
  planId: number,
  dayId: number,
  workoutExerciseId: number,
  updates: { target_sets?: number | null; target_reps?: string | null; target_weight?: number | null; target_duration_seconds?: number | null; has_reps?: boolean; has_weight?: boolean; has_duration?: boolean; notes?: string }
): Promise<WorkoutExercise> {
  return workoutPlansApi.updateExerciseInDay(planId, dayId, workoutExerciseId, updates);
}

export async function replaceSetTargets(
  planId: number,
  dayId: number,
  workoutExerciseId: number,
  targets: { set_number: number; target_reps: string | null; target_weight: number | null; target_duration_seconds: number | null }[]
): Promise<void> {
  return workoutPlansApi.replaceSetTargets(planId, dayId, workoutExerciseId, targets);
}

export async function customizeWeek(planId: number, weekNumber: number): Promise<void> {
  return workoutPlansApi.customizeWeek(planId, weekNumber);
}

export async function matchPreviousWeek(planId: number, weekNumber: number): Promise<void> {
  return workoutPlansApi.matchPreviousWeek(planId, weekNumber);
}
