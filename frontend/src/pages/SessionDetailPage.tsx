import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { SessionDetail } from "../features/sessions/SessionDetail";
import { resolveSessionDay } from "../features/sessions/sessionDayResolver";
import { workoutSessionsApi } from "../api/workoutSessionsApi";
import { getWorkoutPlanDetail, type WorkoutPlanDetail } from "../api/workoutPlansApi";
import { useLanguage } from "../contexts/LanguageContext";

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [planDetail, setPlanDetail] = useState<WorkoutPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [sessionId]);

  async function loadData() {
    if (!sessionId) {
      setError(t.activeWorkoutPage.sessionIdMissing);
      setLoading(false);
      return;
    }

    try {
      // Fetch session detail
      const detail = await workoutSessionsApi.getSessionDetail(Number(sessionId));
      setSessionDetail(detail);

      // Fetch plan detail only if the plan still exists
      // (workout_plan_id is null if the plan was deleted; backend provides plan_name as "Deleted Plan")
      if (detail.session.workout_plan_id !== null) {
        const plan = await getWorkoutPlanDetail(detail.session.workout_plan_id);
        setPlanDetail(plan);
      } else {
        setPlanDetail(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t.activeWorkoutPage.loadSessionFailed);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Layout><div className="loading">{t.sessionDetailPage.loadingSession}</div></Layout>;
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
                color: "var(--danger)",
                fontSize: "20px",
                cursor: "pointer",
                padding: "0 0 0 12px",
                flex: "0 0 auto",
              }}
              aria-label={t.planBuilder.dismissError}
            >
              ×
            </button>
          </div>
          <button
            onClick={() => navigate("/workout-history")}
            className="btn btn-secondary"
            style={{ marginTop: "16px" }}
          >
            {t.sessionDetailPage.backToHistory}
          </button>
        </div>
      </Layout>
    );

  if (!sessionDetail) {
    return (
      <Layout>
        <div className="page-container">
          <div className="empty-state">
            <p>{t.common2.sessionNotFound}</p>
          </div>
          <button
            onClick={() => navigate("/workout-history")}
            className="btn btn-secondary"
          >
            {t.sessionDetailPage.backToHistory}
          </button>
        </div>
      </Layout>
    );
  }

  // Resolve the day from the plan (if plan still exists; if deleted, use default values)
  let matchingDay: any = null;
  let dayLabel: string;

  if (planDetail) {
    const resolved = resolveSessionDay(
      planDetail,
      sessionDetail.session.plan_day_id
    );
    matchingDay = resolved.matchingDay;
    dayLabel = resolved.dayLabel;
  } else {
    // Plan was deleted, use a default label
    dayLabel = t.sessionDetailPage.unknownDay;
  }

  if (!matchingDay && planDetail) {
    return (
      <Layout>
        <div className="page-container">
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            className="error-message"
          >
            <span>{t.common2.dayNotFound}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: "none",
                border: "none",
                color: "var(--danger)",
                fontSize: "20px",
                cursor: "pointer",
                padding: "0 0 0 12px",
                flex: "0 0 auto",
              }}
              aria-label={t.planBuilder.dismissError}
            >
              ×
            </button>
          </div>
          <button
            onClick={() => navigate("/workout-history")}
            className="btn btn-secondary"
            style={{ marginTop: "16px" }}
          >
            {t.sessionDetailPage.backToHistory}
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
          {t.sessionDetailPage.backToHistoryArrow}
        </button>
        <SessionDetail
          session={sessionDetail.session}
          sets={sessionDetail.sets}
          matchingDay={matchingDay}
          dayLabel={dayLabel}
          planName={sessionDetail.session.plan_name || t.sessionDetail.defaultPlanName}
        />
      </div>
    </Layout>
  );
}
