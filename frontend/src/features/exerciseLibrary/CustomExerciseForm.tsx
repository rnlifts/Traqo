import React, { useState, useEffect } from "react";
import type { Exercise, CreateExerciseRequest, UpdateExerciseRequest } from "../../api/exercisesApi";
import { exercisesApi } from "../../api/exercisesApi";
import { exerciseLibraryApi } from "../../api/exerciseLibraryApi";
import { useToast } from "../../components/Toast";

interface CustomExerciseFormProps {
  mode: "create" | "edit";
  initialValues?: {
    id?: number;
    name: string;
    muscle_group?: string | null;
    equipment?: string | null;
    video_url?: string | null;
  };
  onSaved: (exercise: Exercise) => void;
  onCancel: () => void;
}

export const CustomExerciseForm: React.FC<CustomExerciseFormProps> = ({
  mode,
  initialValues,
  onSaved,
  onCancel,
}) => {
  const { showToast } = useToast();
  const [name, setName] = useState(initialValues?.name || "");
  const [muscleGroup, setMuscleGroup] = useState(initialValues?.muscle_group || "");
  const [equipment, setEquipment] = useState(initialValues?.equipment || "");
  const [videoUrl, setVideoUrl] = useState(initialValues?.video_url || "");
  const [isLoading, setIsLoading] = useState(false);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);
  const [youtubeError, setYoutubeError] = useState<string>("");

  // Validate YouTube URL client-side
  const validateYoutubeUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid
    return (
      url.includes("youtube.com/watch") || url.includes("youtu.be/")
    );
  };

  // Update YouTube error when URL changes
  useEffect(() => {
    if (videoUrl && !validateYoutubeUrl(videoUrl)) {
      setYoutubeError("YouTube URL must contain youtube.com/watch or youtu.be/");
    } else {
      setYoutubeError("");
    }
  }, [videoUrl]);

  // Load muscle groups and equipment options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const groups = await exerciseLibraryApi.getMuscleGroups();
        setMuscleGroups(groups);

        const equipment = await exerciseLibraryApi.getEquipmentOptions();
        setEquipmentOptions(equipment);
      } catch (error) {
        console.error("Failed to load options:", error);
        showToast("Failed to load options", "error");
      }
    };

    loadOptions();
  }, [showToast]);

  const isFormValid = name.trim() && !youtubeError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      return;
    }

    setIsLoading(true);
    try {
      const request = {
        name: name.trim(),
        muscle_group: muscleGroup || null,
        equipment: equipment || null,
        video_url: videoUrl || null,
      };

      let exercise: Exercise;
      if (mode === "create") {
        exercise = await exercisesApi.create(request as CreateExerciseRequest);
        showToast("Exercise created successfully", "success");
      } else {
        if (!initialValues?.id) {
          throw new Error("Exercise ID is required for edit mode");
        }
        exercise = await exercisesApi.update(
          initialValues.id,
          request as UpdateExerciseRequest
        );
        showToast("Exercise updated successfully", "success");
      }

      onSaved(exercise);
    } catch (error: any) {
      console.error("Failed to save exercise:", error);
      const message = error?.response?.data?.error || error?.message || "Failed to save exercise";
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <label className="field-label">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Exercise name"
          className="input-field"
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="field-label">Muscle Group</label>
        <input
          type="text"
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
          placeholder="e.g. chest, back, biceps"
          className="input-field"
          disabled={isLoading}
          list="muscle-group-suggestions"
        />
        <datalist id="muscle-group-suggestions">
          {muscleGroups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
      </div>

      <div>
        <label className="field-label">Equipment</label>
        <input
          type="text"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          placeholder="e.g. barbell, dumbbell, bodyweight"
          className="input-field"
          disabled={isLoading}
          list="equipment-suggestions"
        />
        <datalist id="equipment-suggestions">
          {equipmentOptions.map((eq) => (
            <option key={eq} value={eq} />
          ))}
        </datalist>
      </div>

      <div>
        <label className="field-label">YouTube Link</label>
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
          className="input-field"
          disabled={isLoading}
          style={{
            borderColor: youtubeError ? "var(--danger)" : undefined,
          }}
        />
        {youtubeError && (
          <div style={{ fontSize: "13px", color: "var(--danger)", marginTop: "6px" }}>
            {youtubeError}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "12px", paddingTop: "8px" }}>
        <button
          type="submit"
          disabled={!isFormValid || isLoading}
          className="btn btn-primary"
          style={{ flex: 1 }}
        >
          {isLoading ? "Saving..." : mode === "create" ? "Create Exercise" : "Update Exercise"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="btn btn-secondary"
          style={{ flex: 1 }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
