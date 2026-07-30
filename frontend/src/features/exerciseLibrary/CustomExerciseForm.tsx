import React, { useState, useEffect } from "react";
import type { Exercise, CreateExerciseRequest } from "../../api/exercisesApi";
import { exercisesApi } from "../../api/exercisesApi";
import { exerciseLibraryApi } from "../../api/exerciseLibraryApi";
import { useToast } from "../../components/Toast";
import styles from "./CustomExerciseForm.module.css";

interface CustomExerciseFormProps {
  initialName?: string;
  onCreated: (exercise: Exercise) => void;
}

export const CustomExerciseForm: React.FC<CustomExerciseFormProps> = ({
  initialName = "",
  onCreated,
}) => {
  const { showToast } = useToast();

  // Form state
  const [name, setName] = useState(initialName);
  const [muscleGroup, setMuscleGroup] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  // Dropdown options
  const [muscleGroupOptions, setMuscleGroupOptions] = useState<string[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);

  // Fetch dropdown options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [groups, equipment] = await Promise.all([
          exerciseLibraryApi.getMuscleGroups(),
          exercisesApi.getEquipmentOptions(),
        ]);
        setMuscleGroupOptions(groups);
        setEquipmentOptions(equipment);
      } catch (error) {
        console.error("Failed to fetch dropdown options:", error);
      }
    };

    fetchOptions();
  }, []);

  // Validate YouTube URL (mirrors backend validation from Task 44)
  const isValidYoutubeUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid
    const validPatterns = ["youtube.com/watch", "youtu.be/"];
    return validPatterns.some((pattern) => url.includes(pattern));
  };

  // Handle video URL change with validation
  const handleVideoUrlChange = (value: string) => {
    setVideoUrl(value);
    if (value && !isValidYoutubeUrl(value)) {
      setYoutubeError("Please provide a valid YouTube link");
    } else {
      setYoutubeError(null);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("Exercise name is required", "error");
      return;
    }

    if (videoUrl && !isValidYoutubeUrl(videoUrl)) {
      showToast("Please provide a valid YouTube link", "error");
      return;
    }

    setIsLoading(true);
    try {
      const request: CreateExerciseRequest = {
        name: name.trim(),
      };

      if (muscleGroup) {
        request.muscle_group = muscleGroup;
      }
      if (equipment) {
        request.equipment = equipment;
      }
      if (videoUrl) {
        request.video_url = videoUrl;
      }

      const exercise = await exercisesApi.create(request);
      onCreated(exercise);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail || "Failed to create exercise";
      showToast(errorMessage, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = !name.trim() || !!youtubeError || isLoading;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formGroup}>
        <label htmlFor="name" className={styles.label}>
          Exercise Name <span className={styles.required}>*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Bench Press"
          className={styles.input}
          disabled={isLoading}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="muscleGroup" className={styles.label}>
          Muscle Group
        </label>
        <select
          id="muscleGroup"
          value={muscleGroup || ""}
          onChange={(e) => setMuscleGroup(e.target.value || null)}
          className={styles.select}
          disabled={isLoading}
        >
          <option value="">— None selected —</option>
          {muscleGroupOptions.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="equipment" className={styles.label}>
          Equipment
        </label>
        <select
          id="equipment"
          value={equipment || ""}
          onChange={(e) => setEquipment(e.target.value || null)}
          className={styles.select}
          disabled={isLoading}
        >
          <option value="">— None selected —</option>
          {equipmentOptions.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="videoUrl" className={styles.label}>
          YouTube Demo Link
        </label>
        <input
          id="videoUrl"
          type="text"
          value={videoUrl}
          onChange={(e) => handleVideoUrlChange(e.target.value)}
          onBlur={() => {
            if (videoUrl && !isValidYoutubeUrl(videoUrl)) {
              setYoutubeError("Please provide a valid YouTube link");
            }
          }}
          placeholder="https://www.youtube.com/watch?v=..."
          className={`${styles.input} ${youtubeError ? styles.inputError : ""}`}
          disabled={isLoading}
        />
        {youtubeError && (
          <p className={styles.errorText}>{youtubeError}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitDisabled}
        className={styles.submitButton}
      >
        {isLoading ? "Creating..." : "Create Exercise"}
      </button>
    </form>
  );
};
