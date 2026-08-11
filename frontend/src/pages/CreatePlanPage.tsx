import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { CreatePlanStep1 } from '../features/workoutPlans/CreatePlanStep1';
import { PlanBuilder } from '../features/workoutPlans/PlanBuilder';
import { Layout } from '../components/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useLanguage } from '../contexts/LanguageContext';

interface PlanDraft {
  name: string;
  unitType: 'days' | 'weeks';
  totalUnits: number;
}

export default function CreatePlanPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { setHasUnsavedChanges } = useUnsavedChanges();

  useEffect(() => {
    // Set unsaved flag when entering plan creation
    setHasUnsavedChanges(true);

    // Clean up: reset flag when leaving plan creation
    return () => {
      setHasUnsavedChanges(false);
    };
  }, [setHasUnsavedChanges]);

  const handleContinue = (planDraft: PlanDraft) => {
    setDraft(planDraft);
    setStep(2);
  };

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  return (
    <Layout>
      {step === 1 && <CreatePlanStep1 onContinue={handleContinue} onCancel={handleCancel} />}
      {step === 2 && draft && <PlanBuilder draft={draft} isCreateMode={true} />}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        title={t.planBuilder.leavePlanCreation}
        message={t.planBuilder.leavePlanMessage}
        confirmText={t.planBuilder.goBack}
        cancelText={t.planBuilder.stay}
        isDangerous={true}
        onConfirm={() => navigate('/workout-plans')}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </Layout>
  );
}
