import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ActiveWorkout } from "../features/sessions/ActiveWorkout";
import { workoutSessionsApi, type WorkoutSet } from "../api/workoutSessionsApi";
import { getWorkoutPlanDetail, getPreviousPerformance, type PreviousPerformanceResponse, type WorkoutPlanDetail } from "../api/workoutPlansApi";
import { resolveSessionDay } from "../features/sessions/sessionDayResolver";
import { Layout } from "../components/Layout";

interface Exercise {
  id: number;
  name: string;
  logging_type: string;
}

export default function ActiveWorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<any>(null);
  const [planDetail, setPlanDetail] = useState<WorkoutPlanDetail | null>(null);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [previousPerformance, setPreviousPerformance] = useState<PreviousPerformanceResponse | null>(null);
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
      // Check if we have prefetched data from SessionSetupPage
      const prefetchedPlanDetail = (location.state as any)?.prefetchedPlanDetail;
      const prefetchedExercises = (location.state as any)?.prefetchedExercises;

      if (prefetchedPlanDetail && prefetchedExercises) {
        // Prefetched path: came from "Begin Workout" on SessionSetupPage
        // Only need to fetch session detail; plan and exercises are already loaded
        const sessionDetail = await workoutSessionsApi.getSessionDetail(Number(sessionId));
        setSession(sessionDetail.session);
        setSets(sessionDetail.sets);
        setPlanDetail(prefetchedPlanDetail);
        setAvailableExercises(prefetchedExercises);
        setLoading(false);

        // Fetch previous performance in the background (non-blocking)
        if (sessionDetail.session.workout_plan_id && sessionDetail.session.plan_day_id) {
          getPreviousPerformance(
            sessionDetail.session.workout_plan_id,
            sessionDetail.session.plan_day_id,
            Number(sessionId)
          )
            .then((previous) => setPreviousPerformance(previous))
            .catch((err) => {
              // Fail silently for non-critical previous performance data
              console.error("Failed to load previous performance:", err);
            });
        }
      } else {
        // Fallback path: no prefetched data (refresh, direct URL, resume from dashboard, etc.)
        // Use bootstrap to get everything
        const bootstrap = await workoutSessionsApi.getActiveWorkoutBootstrap(Number(sessionId));
        setSession(bootstrap.session.session);
        setSets(bootstrap.session.sets);
        setPlanDetail(bootstrap.plan);
        setAvailableExercises(bootstrap.exercises);
        setLoading(false);

        // Fetch previous performance in the background (non-blocking)
        if (bootstrap.session.session.workout_plan_id && bootstrap.session.session.plan_day_id) {
          getPreviousPerformance(
            bootstrap.session.session.workout_plan_id,
            bootstrap.session.session.plan_day_id,
            Number(sessionId)
          )
            .then((previous) => setPreviousPerformance(previous))
            .catch((err) => {
              // Fail silently for non-critical previous performance data
              console.error("Failed to load previous performance:", err);
            });
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load workout session");
      setLoading(false);
    }
  }

  const handleFinish = () => {
    navigate("/dashboard");
  };

  const handleRefreshPlanDetail = async () => {
    if (session) {
      try {
        const plan = await getWorkoutPlanDetail(session.workout_plan_id);
        setPlanDetail(plan);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to refresh plan details");
      }
    }
  };

  if (loading) return <Layout><div style={{ padding: "20px" }}>Loading...</div></Layout>;
  if (error) return (
    <Layout>
      <div style={{ padding: "20px" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="error-message">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#721c24',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 0 0 12px',
              flex: '0 0 auto'
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
        <button
          onClick={() => navigate('/workout-plans')}
          className="btn btn-secondary"
          style={{ marginTop: "16px" }}
        >
          Back to Plans
        </button>
      </div>
    </Layout>
  );
  if (!session || !planDetail) return <Layout><div style={{ padding: "20px" }}>Session not found</div></Layout>;

  // Resolve the day from the plan using the helper function
  const { matchingDay, dayLabel } = resolveSessionDay(planDetail, session.plan_day_id);

  if (!matchingDay) {
    return (
      <Layout>
        <div style={{ padding: "20px" }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="error-message">
            <span>Day not found for this workout session</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#721c24',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 0 0 12px',
                flex: '0 0 auto'
              }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
          <button
            onClick={() => navigate('/workout-plans')}
            className="btn btn-secondary"
            style={{ marginTop: "16px" }}
          >
            Back to Plans
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <ActiveWorkout
          session={session}
          planExercises={matchingDay.exercises}
          availableExercises={availableExercises}
          onFinish={handleFinish}
          initialSets={sets}
          previousPerformance={previousPerformance}
          planId={planDetail.plan.id}
          dayId={matchingDay.id}
          planName={planDetail.plan.name}
          dayLabel={dayLabel}
          isQuickStart={!!planDetail.plan.is_quick_start}
          onPlanDetailRefresh={handleRefreshPlanDetail}
        />
      </div>
    </Layout>
  );
}
