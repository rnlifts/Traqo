import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listWorkoutPlans,
  deleteWorkoutPlan,
  duplicateWorkoutPlan,
} from "../../api/workoutPlansApi";
import type { WorkoutPlan } from "../../api/workoutPlansApi";
import { sharingApi } from "../../api/sharingApi";
import type { SharedWithMeEntry } from "../../api/sharingApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { PlanActionCards } from "../../components/PlanActionCards";
import { CopyIcon } from "../../components/icons";
import { ShareDialog } from "../../features/sharing/ShareDialog";
import { useLanguage } from "../../contexts/LanguageContext";
import type { TranslationKeys } from "../../i18n/en";

function planSummary(plan: WorkoutPlan, t: TranslationKeys['planList']): string {
  if (!plan.total_units) return "";
  return plan.unit_type === "weeks" ? t.weekCount(plan.total_units) : t.dayCount(plan.total_units);
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
  const [duplicatingPlanId, setDuplicatingPlanId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { Toast, showToast } = useToast();
  const { t } = useLanguage();

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
        err.response?.data?.error || (err as Error).message || t.planList.loadFailed
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
      showToast(t.planList.deleteSuccess, "success");
      await loadPlans();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error || (err as Error).message || t.planList.deleteFailed;
      setError(errorMsg);
    }
  }

  async function handleDuplicatePlan(plan: WorkoutPlan) {
    if (duplicatingPlanId !== null) return;
    setDuplicatingPlanId(plan.id);
    try {
      const newName = t.planList.duplicateName(plan.name);
      await duplicateWorkoutPlan(plan.id, newName);
      setError("");
      showToast(t.planList.duplicateSuccess(newName), "success");
      await loadPlans();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error || (err as Error).message || t.planList.duplicateFailed;
      setError(errorMsg);
    } finally {
      setDuplicatingPlanId(null);
    }
  }

  return (
    <div className="page-container">
      <p className="kicker">{t.planList.kicker}</p>
      <h1 className="page-title">{t.planList.title}</h1>

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
            aria-label={t.planList.dismissError}
          >
            ×
          </button>
        </div>
      )}

      <PlanActionCards />

      <p className="section-label">{t.planList.savedPlans}</p>
      {loading ? (
        <div className="loading">{t.planList.loadingPlans}</div>
      ) : plans.length > 0 ? (
        <div className="plan-grid">
          {plans.map((plan) => (
            <div key={plan.id} className="plan-card">
              <button
                className="duplicate-icon"
                onClick={() => handleDuplicatePlan(plan)}
                disabled={duplicatingPlanId === plan.id}
                aria-label={t.planList.duplicatePlan}
                title={t.planList.duplicatePlan}
              >
                <CopyIcon size={15} />
              </button>
              <button
                className="delete-x"
                onClick={() => handleDeletePlan(plan.id)}
                aria-label={t.planList.deletePlan}
              >
                ✕
              </button>
              <div className="name" onClick={() => navigate(`/workout-plans/${plan.id}/edit`)}>
                {plan.name}
              </div>
              {planSummary(plan, t.planList) && <div className="meta">{planSummary(plan, t.planList)}</div>}
              <div className="card-actions">
                <button
                  className="btn-start"
                  onClick={() => navigate(`/workout-plans/${plan.id}/start`)}
                >
                  {t.planList.start}
                </button>
                <button
                  className="btn-edit"
                  onClick={() => navigate(`/workout-plans/${plan.id}/edit`)}
                >
                  {t.planList.edit}
                </button>
                <button
                  className="btn-share"
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    setShareDialogOpen(true);
                  }}
                >
                  {t.planList.share}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-note">{t.planList.noPlans}</p>
      )}

      <p className="section-label">{t.planList.sharedWithMe}</p>
      {sharedWithMeLoading ? (
        <div className="loading">{t.planList.loadingShared}</div>
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
                {t.planList.sharedBy(entry.owner_username, entry.permission)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-note">
          {t.planList.noShared}
        </p>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t.planList.deleteTitle}
        message={t.planList.deleteMessage}
        confirmText={t.planList.delete}
        cancelText={t.planList.cancel}
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
