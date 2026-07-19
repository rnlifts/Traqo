import client from "./client";

export interface WorkoutSet {
  id: number;
  workout_session_id: number;
  exercise_id: number;
  set_number: number;
  weight: number;
  reps: number;
  notes: string;
}

export interface WorkoutSession {
  id: number;
  user_id: number;
  workout_plan_id: number;
  plan_day_id: number;
  started_at: string;
  completed_at: string | null;
}

export interface StartWorkoutRequest {
  workout_plan_id: number;
  plan_day_id: number;
}

export interface StartWorkoutResponse {
  session_id: number;
  message: string;
}

export interface WorkoutSessionDetailResponse {
  session: WorkoutSession;
  sets: WorkoutSet[];
}

export interface AddWorkoutSetRequest {
  exercise_id: number;
  weight: number;
  reps: number;
  notes?: string;
}

export interface FinishWorkoutResponse {
  message: string;
}

export interface WorkoutHistoryEntry {
  date: string;
  workout: string;
  duration: string;
}

export const workoutSessionsApi = {
  async startWorkout(planId: number, planDayId: number): Promise<StartWorkoutResponse> {
    const response = await client.post<StartWorkoutResponse>(
      "/workout-sessions",
      { workout_plan_id: planId, plan_day_id: planDayId }
    );
    return response.data;
  },

  async getSessionDetail(sessionId: number): Promise<WorkoutSessionDetailResponse> {
    const response = await client.get<WorkoutSessionDetailResponse>(
      `/workout-sessions/${sessionId}`
    );
    return response.data;
  },

  async addWorkoutSet(
    sessionId: number,
    exerciseId: number,
    weight: number,
    reps: number,
    notes: string = ""
  ): Promise<WorkoutSet> {
    const response = await client.post<WorkoutSet>(
      `/workout-sessions/${sessionId}/sets`,
      {
        exercise_id: exerciseId,
        weight,
        reps,
        notes,
      }
    );
    return response.data;
  },

  async finishWorkout(sessionId: number): Promise<FinishWorkoutResponse> {
    const response = await client.put<FinishWorkoutResponse>(
      `/workout-sessions/${sessionId}/finish`
    );
    return response.data;
  },

  async getWorkoutHistory(): Promise<WorkoutHistoryEntry[]> {
    const response = await client.get<WorkoutHistoryEntry[]>("/workout-history");
    return response.data;
  },

  async quickStart(): Promise<StartWorkoutResponse> {
    const response = await client.post<StartWorkoutResponse>(
      "/workout-sessions/quick-start"
    );
    return response.data;
  },
};
