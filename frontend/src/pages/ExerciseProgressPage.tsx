import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { ExerciseProgress } from "../features/progress/ExerciseProgress";
import { progressApi, type ExerciseProgressResult } from "../api/progressApi";

export default function ExerciseProgressPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ExerciseProgressResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [exerciseId]);

  async function loadData() {
    if (!exerciseId) {
      setError("Exercise ID not provided");
      setLoading(false);
      return;
    }

    try {
      const progressData = await progressApi.getExerciseProgress(Number(exerciseId));
      setData(progressData);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load exercise progress");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="page-container">
        <button
          onClick={() => navigate("/exercises")}
          className="btn btn-secondary"
          style={{ marginBottom: "20px" }}
        >
          ← Back to Exercises
        </button>
        <ExerciseProgress data={data!} loading={loading} error={error} />
      </div>
    </Layout>
  );
}
