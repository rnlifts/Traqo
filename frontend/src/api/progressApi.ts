import client from "./client";

export interface ProgressSet {
  set_number: number;
  weight: number | null;
  reps: number | null;
  notes: string;
  estimated_1rm: number | null;
  is_weight_pr: boolean;
  is_reps_pr: boolean;
  is_e1rm_pr: boolean;
}

export interface ProgressSessionEntry {
  session_id: number;
  date: string;
  sets: ProgressSet[];
  volume: number;
  is_volume_pr: boolean;
}

export interface PersonalRecords {
  heaviest_weight: number | null;
  heaviest_weight_date: string | null;
  best_estimated_1rm: number | null;
  best_estimated_1rm_date: string | null;
  best_volume: number | null;
  best_volume_date: string | null;
  most_reps: number | null;
  most_reps_date: string | null;
}

export interface ExerciseProgressResult {
  exercise_id: number;
  exercise_name: string;
  sessions: ProgressSessionEntry[];
  personal_records: PersonalRecords;
}

export const progressApi = {
  async getExerciseProgress(
    exerciseId: number
  ): Promise<ExerciseProgressResult> {
    const response = await client.get<ExerciseProgressResult>(
      `/exercises/${exerciseId}/progress`
    );
    return response.data;
  },
};
