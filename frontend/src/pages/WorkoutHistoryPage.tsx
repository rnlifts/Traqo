import React, { useEffect, useState } from "react";
import type { WorkoutHistoryEntry } from "../api/workoutSessionsApi";
import { workoutSessionsApi } from "../api/workoutSessionsApi";
import { WorkoutHistory } from "../features/sessions/WorkoutHistory";
import { Layout } from "../components/Layout";

export const WorkoutHistoryPage: React.FC = () => {
  const [entries, setEntries] = useState<WorkoutHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await workoutSessionsApi.getWorkoutHistory();
        setEntries(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch workout history"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Workout History</h1>
        <p className="page-subtitle">View your past workouts and progress.</p>
        <WorkoutHistory entries={entries} loading={loading} error={error} />
      </div>
    </Layout>
  );
};
