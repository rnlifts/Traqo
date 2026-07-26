import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { SessionDetail } from "../features/sessions/SessionDetail";
import { resolveSessionDay } from "../features/sessions/sessionDayResolver";
import { workoutSessionsApi } from "../api/workoutSessionsApi";
import { getWorkoutPlanDetail, type WorkoutPlanDetail } from "../api/workoutPlansApi";

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [planDetail, setPlanDetail] = useState<WorkoutPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [sessionId]);

  async function loadData() {
    if (!sessionId) {
      setError("Session ID not provided");
      setLoading(false);
      return;
    }

    try {
      // Fetch session detail
      const detail = await workoutSessionsApi.getSessionDetail(Number(sessionId));
      setSessionDetail(detail);

      // Fetch plan detail
      const plan = await getWorkoutPlanDetail(detail.session.workout_plan_id);
      setPlanDetail(plan);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load workout session");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Layout><div className="loading">Loading session details...</div></Layout>;
  if (error)
    return (
      <Layout>
        <div className="page-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} className="error-message">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
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
          <button
            onClick={() => navigate("/workout-history")}
            className="btn btn-secondary"
            style={{ marginTop: "16px" }}
          >
            Back to History
          </button>
        </div>
      </Layout>
    );

  if (!sessionDetail || !planDetail) {
    return (
      <Layout>
        <div className="page-container">
          <div className="empty-state">
            <p>Session not found</p>
          </div>
          <button
            onClick={() => navigate("/workout-history")}
            className="btn btn-secondary"
          >
            Back to History
          </button>
        </div>
      </Layout>
    );
  }

  // Resolve the day from the plan
  const { matchingDay, dayLabel } = resolveSessionDay(
    planDetail,
    sessionDetail.session.plan_day_id
  );

  if (!matchingDay) {
    return (
      <Layout>
        <div className="page-container">
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            className="error-message"
          >
            <span>Day not found for this workout session</span>
            <button
              onClick={() => setError(null)}
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
          <button
            onClick={() => navigate("/workout-history")}
            className="btn btn-secondary"
            style={{ marginTop: "16px" }}
          >
            Back to History
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <button
          onClick={() => navigate("/workout-history")}
          className="btn btn-secondary"
          style={{ marginBottom: "20px" }}
        >
          ← Back to History
        </button>
        <SessionDetail
          session={sessionDetail.session}
          sets={sessionDetail.sets}
          matchingDay={matchingDay}
          dayLabel={dayLabel}
          planName={sessionDetail.session.plan_name || "Workout"}
        />
      </div>
    </Layout>
  );
}
