import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listWorkoutPlans,
  createWorkoutPlan,
  deleteWorkoutPlan,
} from "../../api/workoutPlansApi";
import { workoutSessionsApi } from "../../api/workoutSessionsApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

interface WorkoutPlan {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function PlanList() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [newPlanName, setNewPlanName] = useState("");
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

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlanName.trim()) return;

    try {
      await createWorkoutPlan(newPlanName);
      setNewPlanName("");
      setError("");
      showToast("Workout plan created successfully!", "success");
      await loadPlans();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error || (err as Error).message || "Failed to create plan";
      setError(errorMsg);
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

  async function handleDeletePlan(planId: number) {
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
      <h2>Workout Plans</h2>

      <div style={{ marginBottom: "20px" }}>
        <form onSubmit={handleCreatePlan} style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <input
            type="text"
            placeholder="New plan name"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            className="input-field"
          />
          <button type="submit" className="btn btn-primary">Create Plan</button>
        </form>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <p style={{ margin: "0 12px", color: "var(--text)" }}>or</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <button
            onClick={handleQuickStart}
            disabled={quickStarting}
            className="btn btn-success"
            style={{ opacity: quickStarting ? 0.6 : 1 }}
          >
            {quickStarting ? "Starting..." : "Log Today's Workout"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="error-message">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
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
      )}

      <div style={{ display: "grid", gap: "12px" }}>
        {plans.length > 0 ? (
          plans.map((plan) => (
            <div key={plan.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  onClick={() => navigate(`/workout-plans/${plan.id}`)}
                  style={{ cursor: "pointer", fontWeight: "bold", flex: 1 }}
                >
                  {plan.name}
                </span>
                <button
                  onClick={() => handleDeletePlan(plan.id)}
                  className="btn btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No workout plans yet. Create one to get started!</p>
          </div>
        )}
      </div>

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
