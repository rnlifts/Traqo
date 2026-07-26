import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listWorkoutPlans,
  deleteWorkoutPlan,
} from "../../api/workoutPlansApi";
import type { WorkoutPlan } from "../../api/workoutPlansApi";
import { workoutSessionsApi } from "../../api/workoutSessionsApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

function planSummary(plan: WorkoutPlan): string {
  if (!plan.total_units) return "";
  const unit = plan.unit_type === "weeks" ? "WEEK" : "DAY";
  return `${plan.total_units} ${unit}${plan.total_units === 1 ? "" : "S"}`;
}

export default function PlanList() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [quickStarting, setQuickStarting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    planId: number | null;
  }>({ isOpen: false, planId: null });
  const navigate = useNavigate();
  const { Toast, showToast } = useToast();

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      const data = await listWorkoutPlans();
      setPlans(data);
    } catch (err: any) {
      setError(
        err.response?.data?.error || (err as Error).message || "Failed to load plans"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickStart() {
    setQuickStarting(true);
    try {
      const response = await workoutSessionsApi.quickStart();
      navigate(`/workout-sessions/${response.session_id}`);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error || (err as Error).message || "Failed to start quick workout";
      setError(errorMsg);
      setQuickStarting(false);
    }
  }

  function handleDeletePlan(planId: number) {
    setDeleteConfirm({ isOpen: true, planId });
  }

  async function confirmDelete() {
    const planId = deleteConfirm.planId;
    setDeleteConfirm({ isOpen: false, planId: null });

    if (!planId) return;

    try {
      await deleteWorkoutPlan(planId);
      setError("");
      showToast("Workout plan deleted successfully!", "success");
      await loadPlans();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error || (err as Error).message || "Failed to delete plan";
      setError(errorMsg);
    }
  }

  if (loading) return <div className="loading">Loading workout plans...</div>;

  return (
    <div className="page-container">
      <p className="kicker">Your ledger</p>
      <h1 className="page-title">Workout Plans</h1>

      {error && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} className="error-message">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
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
      )}

      <button className="create-tile" onClick={() => navigate("/workout-plans/new")}>
        <span className="plus">+</span>
        <span>
          <span className="label">Create exercise plan</span>
          <div className="sub">Name it, set the length, fill in the days.</div>
        </span>
      </button>

      <div style={{ marginTop: "10px" }}>
        <button onClick={handleQuickStart} disabled={quickStarting} className="btn-link">
          {quickStarting ? "Starting…" : "Or log today's workout without a plan →"}
        </button>
      </div>

      <p className="section-label">Saved plans</p>
      {plans.length > 0 ? (
        <div className="plan-grid">
          {plans.map((plan) => (
            <div key={plan.id} className="plan-card">
              <button
                className="delete-x"
                onClick={() => handleDeletePlan(plan.id)}
                aria-label="Delete plan"
              >
                ✕
              </button>
              <div className="name" onClick={() => navigate(`/workout-plans/${plan.id}/edit`)}>
                {plan.name}
              </div>
              {planSummary(plan) && <div className="meta">{planSummary(plan)}</div>}
              <div className="card-actions">
                <button
                  className="btn-start"
                  onClick={() => navigate(`/workout-plans/${plan.id}/start`)}
                >
                  ▶ Start
                </button>
                <button
                  className="btn-edit"
                  onClick={() => navigate(`/workout-plans/${plan.id}/edit`)}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-note">Nothing saved yet — plans you create will show up here.</p>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Workout Plan"
        message="Are you sure you want to delete this workout plan? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, planId: null })}
      />

      {Toast}
    </div>
  );
}
