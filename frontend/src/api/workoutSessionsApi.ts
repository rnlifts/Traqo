import client from "./client";
import type { WorkoutPlanDetail } from "./workoutPlansApi";
import type { Exercise } from "./exercisesApi";

export interface WorkoutSet {
  id: number;
  workout_session_id: number;
  exercise_id: number;
  workout_exercise_id: number | null;
  set_number: number;
  weight: number | null;
  reps: number | null;
  duration_seconds: number | null;
  notes: string;
}

export interface WorkoutSetWithExercise extends WorkoutSet {
  exercise_name: string;
}

export interface WorkoutSession {
  id: number;
  user_id: number;
  workout_plan_id: number;
  plan_day_id: number;
  started_at: string;
  completed_at: string | null;
  plan_name?: string;
  day_label?: string | null;
  plan_week_id?: number | null;
  week_number?: number | null;
  duration_minutes?: number | null;
}

export interface WorkoutSessionDetail {
  session: WorkoutSession;
  sets: WorkoutSetWithExercise[];
}

export interface StartWorkoutRequest {
  workout_plan_id: number;
  plan_day_id: number;
}

export interface StartWorkoutResponse {
  session_id: number;
  message: string;
}

export interface WorkoutSessionDetailResponse extends WorkoutSessionDetail {}

export interface AddWorkoutSetRequest {
  exercise_id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  duration_seconds?: number | null;
  notes?: string;
}

export interface FinishWorkoutResponse {
  message: string;
}

export interface WorkoutHistoryEntry {
  session_id?: number;
  date: string;
  workout: string;
  duration: string;
}

export interface ActiveWorkoutBootstrap {
  session: WorkoutSessionDetailResponse;
  plan: WorkoutPlanDetail | null;
  exercises: Exercise[];
}

export const workoutSessionsApi = {
  async startWorkout(planId: number, planDayId: number, weekNumber?: number): Promise<StartWorkoutResponse> {
    const payload: any = {
      workout_plan_id: planId,
      plan_day_id: planDayId
    };
    if (weekNumber !== undefined) {
      payload.week_number = weekNumber;
    }
    const response = await client.post<StartWorkoutResponse>(
      "/workout-sessions",
      payload
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
    workoutExerciseId: number,
    setNumber: number,
    weight: number | null,
    reps: number | null,
    durationSeconds: number | null = null,
    notes: string = ""
  ): Promise<WorkoutSet> {
    const response = await client.post<WorkoutSet>(
      `/workout-sessions/${sessionId}/sets`,
      {
        workout_exercise_id: workoutExerciseId,
        set_number: setNumber,
        weight,
        reps,
        duration_seconds: durationSeconds,
        notes,
      }
    );
    return response.data;
  },

  async deleteWorkoutSet(sessionId: number, setId: number): Promise<void> {
    await client.delete(`/workout-sessions/${sessionId}/sets/${setId}`);
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

  async getUnresolvedSession(): Promise<WorkoutSession | null> {
    const response = await client.get<{ session: WorkoutSession | null }>(
      "/workout-sessions/unresolved"
    );
    return response.data.session;
  },

  async discardSession(sessionId: number): Promise<void> {
    await client.delete(`/workout-sessions/${sessionId}`);
  },

  async getActiveWorkoutBootstrap(sessionId: number): Promise<ActiveWorkoutBootstrap> {
    const response = await client.get<ActiveWorkoutBootstrap>(
      `/workout-sessions/${sessionId}/bootstrap`
    );
    return response.data;
  },
};
