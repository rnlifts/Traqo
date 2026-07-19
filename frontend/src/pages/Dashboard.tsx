import React, { useState, useEffect } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { Layout } from "../components/Layout";
import type { WorkoutHistoryEntry } from "../api/workoutSessionsApi";
import { workoutSessionsApi } from "../api/workoutSessionsApi";

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentWorkouts = async () => {
      try {
        const data = await workoutSessionsApi.getWorkoutHistory();
        setRecentWorkouts(data.slice(0, 3));
      } catch (error) {
        console.error("Failed to load recent workouts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentWorkouts();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <Layout>
      <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
        <h1>Dashboard</h1>
        <p>Welcome, {currentUser?.display_name}!</p>

        <section style={{ marginTop: "40px" }}>
          <h2>Recent Workouts</h2>
          {loading ? (
            <div className="loading">Loading workout history...</div>
          ) : recentWorkouts.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {recentWorkouts.map((workout, idx) => (
                <div key={idx} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 4px 0" }}>
                        {formatDate(workout.date)}
                      </p>
                      <p style={{ fontSize: "14px", color: "var(--text)", margin: "0 0 4px 0" }}>
                        {workout.workout}
                      </p>
                      <p style={{ fontSize: "13px", color: "var(--text)", margin: "0" }}>
                        Duration: {workout.duration}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No workouts yet. Start by creating a workout!</p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};
