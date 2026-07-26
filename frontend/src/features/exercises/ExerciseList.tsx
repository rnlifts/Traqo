import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Exercise } from "../../api/exercisesApi";
import { exercisesApi } from "../../api/exercisesApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

interface ExerciseListProps {
  onDeleted?: () => void;
}

export const ExerciseList: React.FC<ExerciseListProps> = ({ onDeleted }) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    exerciseId: number | null;
  }>({ isOpen: false, exerciseId: null });
  const { Toast, showToast } = useToast();

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await exercisesApi.list();
      setExercises(data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load exercises");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (exerciseId: number) => {
    setDeleteConfirm({ isOpen: true, exerciseId });
  };

  const confirmDelete = async () => {
    const exerciseId = deleteConfirm.exerciseId;
    setDeleteConfirm({ isOpen: false, exerciseId: null });

    if (!exerciseId) return;

    setDeletingId(exerciseId);
    try {
      await exercisesApi.delete(exerciseId);
      setExercises(exercises.filter((e) => e.id !== exerciseId));
      setError(null);
      showToast("Exercise deleted successfully!", "success");
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete exercise");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="loading">Loading exercises...</div>;

  return (
    <>
      {error && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="error-message">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
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

      {exercises.length === 0 ? (
        <div className="empty-state"><p>No exercises yet. Create one to get started!</p></div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}
            >
              <span style={{ flex: 1 }}>
                {exercise.name}
                {exercise.category && ` — ${exercise.category}`}
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <Link
                  to={`/exercises/${exercise.id}/progress`}
                  className="btn btn-primary"
                  style={{ fontSize: "14px", padding: "8px 12px" }}
                >
                  View Progress
                </Link>
                <button
                  onClick={() => handleDelete(exercise.id)}
                  disabled={deletingId === exercise.id}
                  className="btn btn-danger"
                  style={{ opacity: deletingId === exercise.id ? 0.6 : 1 }}
                >
                  {deletingId === exercise.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Exercise"
        message="Are you sure you want to delete this exercise? It will be removed from all workout plans."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, exerciseId: null })}
      />

      {Toast}
    </>
  );
};
