import client from "./client";

export interface WorkoutPlan {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  id: number;
  plan_day_id: number;
  exercise_id: number;
  order_number: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  exercise_name?: string;
}

export interface PlanDay {
  id: number;
  label: string;
  order_position: number;
  weekdays: string[];
  exercises: WorkoutExercise[];
  created_at: string;
  updated_at: string;
}

export interface WorkoutPlanDetail {
  plan: WorkoutPlan;
  days: PlanDay[];
}

export interface PreviousPerformanceSet {
  set_number: number;
  weight: number;
  reps: number;
}

export interface PreviousPerformanceExercise {
  exercise_id: number;
  sets: PreviousPerformanceSet[];
}

export interface PreviousPerformanceResponse {
  session_date: string | null;
  exercises: PreviousPerformanceExercise[];
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

  async updateDay(planId: number, dayId: number, label: string, weekdays: string[]): Promise<PlanDay> {
    const response = await client.put<PlanDay>(
      `/workout-plans/${planId}/days/${dayId}`,
      { label, weekdays }
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
    targetReps?: number,
    targetWeight?: number
  ): Promise<WorkoutExercise> {
    const body: any = { exercise_id: exerciseId };
    if (targetSets !== undefined) body.target_sets = targetSets;
    if (targetReps !== undefined) body.target_reps = targetReps;
    if (targetWeight !== undefined) body.target_weight = targetWeight;

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
  label: string,
  weekdays: string[]
): Promise<PlanDay> {
  return workoutPlansApi.updateDay(planId, dayId, label, weekdays);
}

export async function deleteDay(planId: number, dayId: number): Promise<void> {
  return workoutPlansApi.deleteDay(planId, dayId);
}

export async function addExerciseToDay(
  planId: number,
  dayId: number,
  exerciseId: number,
  targetSets?: number,
  targetReps?: number,
  targetWeight?: number
): Promise<WorkoutExercise> {
  return workoutPlansApi.addExerciseToDay(planId, dayId, exerciseId, targetSets, targetReps, targetWeight);
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
