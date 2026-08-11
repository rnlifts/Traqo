import { useParams } from 'react-router-dom';
import { PlanBuilder } from '../features/workoutPlans/PlanBuilder';
import { Layout } from '../components/Layout';
import { useLanguage } from '../contexts/LanguageContext';

export default function EditPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const { t } = useLanguage();

  if (!planId) {
    return (
      <Layout>
        <div className="error-message">{t.editPlan.planIdRequired}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PlanBuilder planId={Number(planId)} isCreateMode={false} />
    </Layout>
  );
}
