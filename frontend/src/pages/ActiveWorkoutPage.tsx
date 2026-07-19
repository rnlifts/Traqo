import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ActiveWorkout } from "../features/sessions/ActiveWorkout";
import { workoutSessionsApi, type WorkoutSet } from "../api/workoutSessionsApi";
import { getWorkoutPlanDetail, getPreviousPerformance, type PreviousPerformanceResponse } from "../api/workoutPlansApi";
import { exercisesApi } from "../api/exercisesApi";
import { Layout } from "../components/Layout";

interface Exercise {
  id: number;
  name: string;
}

interface WorkoutPlan {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface WorkoutExercise {
  id: number;
  plan_day_id: number;
  exercise_id: number;
  order_number: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  exercise_name?: string;
}

interface PlanDay {
  id: number;
  label: string;
  order_position: number;
  weekdays: string[];
  exercises: WorkoutExercise[];
  created_at: string;
  updated_at: string;
}

interface WorkoutPlanDetail {
  plan: WorkoutPlan;
  days: PlanDay[];
}

export default function ActiveWorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
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
      // Fetch session detail
      const sessionDetail = await workoutSessionsApi.getSessionDetail(Number(sessionId));
      setSession(sessionDetail.session);
      setSets(sessionDetail.sets);

      // Fetch plan detail
      const plan = await getWorkoutPlanDetail(sessionDetail.session.workout_plan_id);
      setPlanDetail(plan);

      // Fetch available exercises
      const exercises = await exercisesApi.list();
      setAvailableExercises(exercises);

      // Fetch previous performance for this day
      const previous = await getPreviousPerformance(
        sessionDetail.session.workout_plan_id,
        sessionDetail.session.plan_day_id,
        Number(sessionId)
      );
      setPreviousPerformance(previous);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load workout session");
    } finally {
      setLoading(false);
    }
  }

  const handleFinish = () => {
    // Navigate back to the plan detail page
    if (session) {
      navigate(`/workout-plans/${session.workout_plan_id}`);
    }
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

  // Find the matching day from the plan
  const matchingDay = planDetail.days.find((d) => d.id === session.plan_day_id);
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
        <button
          onClick={() => navigate(`/workout-plans/${session.workout_plan_id}`)}
          style={{ margin: "10px 20px", padding: "8px 16px" }}
        >
          Back to Plan
        </button>
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
          onPlanDetailRefresh={handleRefreshPlanDetail}
        />
      </div>
    </Layout>
  );
}
