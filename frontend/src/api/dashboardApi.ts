import client from "./client";

export interface WeeklyStats {
  workout_count: number;
  total_volume: number;
  pr_count: number;
}

export interface DayActivity {
  day_label: string;
  date: string;
  has_workout: boolean;
  session_id: number | null;
}

export interface RandomExercise {
  exercise_id: number;
  exercise_name: string;
}

export interface DashboardSummary {
  weekly_stats: WeeklyStats;
  weekly_activity: DayActivity[];
  random_exercise: RandomExercise | null;
}

export const dashboardApi = {
  async getSummary(): Promise<DashboardSummary> {
    const response = await client.get<DashboardSummary>("/dashboard/summary");
    return response.data;
  },
};
