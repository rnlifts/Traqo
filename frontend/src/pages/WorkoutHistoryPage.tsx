import React, { useEffect, useState } from "react";
import type { WorkoutHistoryEntry } from "../api/workoutSessionsApi";
import { workoutSessionsApi } from "../api/workoutSessionsApi";
import { WorkoutHistory } from "../features/sessions/WorkoutHistory";
import { Layout } from "../components/Layout";
import { useLanguage } from "../contexts/LanguageContext";

export const WorkoutHistoryPage: React.FC = () => {
  const { t } = useLanguage();
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
          err instanceof Error ? err.message : t.workoutHistory.failedToFetch
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
        <h1 className="page-title">{t.workoutHistory.pageTitle}</h1>
        <p className="page-subtitle">{t.workoutHistory.pageSubtitle}</p>
        <WorkoutHistory entries={entries} loading={loading} error={error} />
      </div>
    </Layout>
  );
};
