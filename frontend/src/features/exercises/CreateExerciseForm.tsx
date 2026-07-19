import React, { useState } from "react";
import { exercisesApi } from "../../api/exercisesApi";
import { useToast } from "../../components/Toast";

interface CreateExerciseFormProps {
  onCreated?: () => void;
}

const EXERCISE_CATEGORIES = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Core",
  "Glutes",
  "Cardio",
  "Full Body",
];

export const CreateExerciseForm: React.FC<CreateExerciseFormProps> = ({ onCreated }) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { Toast, showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await exercisesApi.create(name, category || undefined);
      setName("");
      setCategory("");
      showToast("Exercise created successfully!", "success");
      if (onCreated) onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create exercise");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="exerciseName" style={{ display: "block", marginBottom: "5px" }}>
            Exercise Name:
          </label>
          <input
            id="exerciseName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Bench Press"
            required
            className="input-field"
          />
        </div>

        <div style={{ flex: 1 }}>
          <label htmlFor="exerciseCategory" style={{ display: "block", marginBottom: "5px" }}>
            Category:
          </label>
          <select
            id="exerciseCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="input-field"
          >
            <option value="">Select category</option>
            {EXERCISE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-success"
          style={{ alignSelf: "flex-end", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Creating..." : "Add Exercise"}
        </button>
      </form>

      {error && (
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
      )}

      {Toast}
    </>
  );
};
