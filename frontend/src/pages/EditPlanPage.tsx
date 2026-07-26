import { useParams } from 'react-router-dom';
import { PlanBuilder } from '../features/workoutPlans/PlanBuilder';
import { Layout } from '../components/Layout';

export default function EditPlanPage() {
  const { planId } = useParams<{ planId: string }>();

  if (!planId) {
    return (
      <Layout>
        <div className="error-message">Plan ID is required</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PlanBuilder planId={Number(planId)} isCreateMode={false} />
    </Layout>
  );
}
