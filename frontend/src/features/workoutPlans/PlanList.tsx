import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listWorkoutPlans,
  deleteWorkoutPlan,
} from "../../api/workoutPlansApi";
import type { WorkoutPlan } from "../../api/workoutPlansApi";
import { sharingApi } from "../../api/sharingApi";
import type { SharedWithMeEntry } from "../../api/sharingApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { PlanActionCards } from "../../components/PlanActionCards";
import { ShareDialog } from "../../features/sharing/ShareDialog";

function planSummary(plan: WorkoutPlan): string {
  if (!plan.total_units) return "";
  const unit = plan.unit_type === "weeks" ? "WEEK" : "DAY";
  return `${plan.total_units} ${unit}${plan.total_units === 1 ? "" : "S"}`;
}

export default function PlanList() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    planId: number | null;
  }>({ isOpen: false, planId: null });
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [sharedWithMe, setSharedWithMe] = useState<SharedWithMeEntry[]>([]);
  const [sharedWithMeLoading, setSharedWithMeLoading] = useState(true);
  const navigate = useNavigate();
  const { Toast, showToast } = useToast();

  useEffect(() => {
    loadPlans();
    loadSharedWithMe();
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

  async function loadSharedWithMe() {
    try {
      setSharedWithMeLoading(true);
      const data = await sharingApi.getSharedWithMe();
      setSharedWithMe(data);
    } catch (err) {
      // Secondary section - a failure here shouldn't block the main plans list
      // or take over the page's error banner.
      console.error("Error loading shared-with-me plans:", err);
    } finally {
      setSharedWithMeLoading(false);
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

      <PlanActionCards />

      <p className="section-label">Saved plans</p>
      {loading ? (
        <div className="loading">Loading workout plans...</div>
      ) : plans.length > 0 ? (
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
                <button
                  className="btn-share"
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    setShareDialogOpen(true);
                  }}
                >
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-note">Nothing saved yet — plans you create will show up here.</p>
      )}

      <p className="section-label">Shared with me</p>
      {sharedWithMeLoading ? (
        <div className="loading">Loading shared plans...</div>
      ) : sharedWithMe.length > 0 ? (
        <div className="plan-grid">
          {sharedWithMe.map((entry) => (
            <div
              key={entry.token}
              className="plan-card"
              onClick={() => navigate(`/shared/${entry.token}`)}
              style={{ cursor: "pointer" }}
            >
              <div className="name">{entry.plan_name}</div>
              <div className="meta">
                Shared by @{entry.owner_username} — {entry.permission}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-note">
          Nothing shared with you yet — plans someone grants you access to will show up here.
        </p>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Workout Plan"
        message="Are you sure you want to delete this workout plan? This will permanently delete the plan and all of its logged workout history. This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, planId: null })}
      />

      {selectedPlanId !== null && (
        <ShareDialog
          isOpen={shareDialogOpen}
          onClose={() => {
            setShareDialogOpen(false);
            setSelectedPlanId(null);
          }}
          planId={selectedPlanId}
        />
      )}

      {Toast}
    </div>
  );
}
