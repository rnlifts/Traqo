import React, { useState, useEffect, useRef } from "react";
import { exerciseLibraryApi } from "../../api/exerciseLibraryApi";
import type { LibraryExercise } from "../../api/exerciseLibraryApi";
import { exercisesApi } from "../../api/exercisesApi";
import type { Exercise } from "../../api/exercisesApi";
import { CustomExerciseForm } from "./CustomExerciseForm";

interface ExerciseLibrarySidebarProps {
  onSelectExercise: (name: string) => void;
  onExerciseCreated?: (exercise: Exercise) => void;
}

export const ExerciseLibrarySidebar: React.FC<ExerciseLibrarySidebarProps> = ({
  onSelectExercise,
  onExerciseCreated,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [results, setResults] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Custom exercises state
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [customExercisesLoading, setCustomExercisesLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch custom exercises on mount
  useEffect(() => {
    const loadCustomExercises = async () => {
      try {
        const exercises = await exercisesApi.list();
        setCustomExercises(exercises);
      } catch (error) {
        console.error("Failed to load custom exercises:", error);
      } finally {
        setCustomExercisesLoading(false);
      }
    };

    loadCustomExercises();
  }, []);

  // Refresh custom exercises (called after form submission)
  const refreshCustomExercises = async () => {
    try {
      const exercises = await exercisesApi.list();
      setCustomExercises(exercises);
    } catch (error) {
      console.error("Failed to refresh custom exercises:", error);
    }
  };

  // Load muscle groups on mount
  useEffect(() => {
    const loadMuscleGroups = async () => {
      try {
        const groups = await exerciseLibraryApi.getMuscleGroups();
        setMuscleGroups(groups);
      } catch (error) {
        console.error("Failed to load muscle groups:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadMuscleGroups();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const searchResults = await exerciseLibraryApi.search(
          searchQuery || undefined,
          selectedMuscleGroup || undefined
        );
        setResults(searchResults);
      } catch (error) {
        console.error("Failed to search exercises:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, selectedMuscleGroup]);

  const handleSelectExercise = (name: string) => {
    onSelectExercise(name);
    setSearchQuery(""); // Clear search after selection
  };

  const handleCreateNew = () => {
    if (searchQuery.trim()) {
      onSelectExercise(searchQuery);
      setSearchQuery("");
    }
  };

  // Check if the search query exactly matches any result (case-insensitive)
  const hasExactMatch = results.some(
    (r) => r.name.toLowerCase() === searchQuery.toLowerCase()
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderLeft: "1px solid var(--border)",
        padding: "16px",
        backgroundColor: "var(--surface)",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "12px", fontSize: "14px", color: "var(--text)" }}>
        Exercise Library
      </h3>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search exercises..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="input-field"
        style={{ marginBottom: "12px" }}
      />

      {/* Muscle Group Filter Chips */}
      {!initialLoading && muscleGroups.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: "500", marginBottom: "8px", color: "var(--text-h)" }}>
            Muscle Group
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              maxHeight: "80px",
              overflowY: "auto",
            }}
          >
            <button
              onClick={() => setSelectedMuscleGroup(null)}
              style={{
                padding: "6px 12px",
                borderRadius: "16px",
                border: selectedMuscleGroup === null ? `2px solid var(--accent)` : "1px solid var(--border)",
                backgroundColor: selectedMuscleGroup === null ? "var(--accent-soft)" : "var(--surface)",
                color: selectedMuscleGroup === null ? "var(--accent)" : "var(--text)",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: selectedMuscleGroup === null ? "600" : "400",
              }}
            >
              All
            </button>
            {muscleGroups.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedMuscleGroup(group)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "16px",
                  border: selectedMuscleGroup === group ? `2px solid var(--accent)` : "1px solid var(--border)",
                  backgroundColor: selectedMuscleGroup === group ? "var(--accent-soft)" : "var(--surface)",
                  color: selectedMuscleGroup === group ? "var(--accent)" : "var(--text)",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: selectedMuscleGroup === group ? "600" : "400",
                  whiteSpace: "nowrap",
                }}
              >
                {group}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          marginBottom: "12px",
          borderTop: "1px solid var(--border)",
          paddingTop: "12px",
        }}
      >
        {loading && <div style={{ color: "var(--text-h)", fontSize: "13px" }}>Searching...</div>}

        {!loading && results.length === 0 && (
          <div style={{ color: "var(--text-h)", fontSize: "13px" }}>
            {searchQuery ? "No exercises found." : "Start typing to search."}
          </div>
        )}

        {!loading && results.map((exercise) => (
          <div
            key={exercise.id}
            style={{
              marginBottom: "12px",
              padding: "10px",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              backgroundColor: "var(--surface-secondary, white)",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            {/* Thumbnail */}
            {exercise.thumbnail_url ? (
              <img
                src={exercise.thumbnail_url}
                alt={exercise.name}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "4px",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "4px",
                  backgroundColor: "var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-h)",
                  fontSize: "20px",
                  flexShrink: 0,
                }}
              >
                💪
              </div>
            )}

            {/* Info + Button */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: "500",
                  fontSize: "13px",
                  color: "var(--text)",
                  marginBottom: "4px",
                  wordBreak: "break-word",
                }}
              >
                {exercise.name}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-h)", marginBottom: "4px" }}>
                {exercise.muscle_group}
              </div>
              {exercise.equipment && (
                <div style={{ fontSize: "11px", color: "var(--text-h)", fontStyle: "italic" }}>
                  {exercise.equipment}
                </div>
              )}
              <button
                onClick={() => handleSelectExercise(exercise.name)}
                style={{
                  marginTop: "6px",
                  padding: "4px 10px",
                  backgroundColor: "var(--success)",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                + Add
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create New Exercise Affordance */}
      {!loading && searchQuery.trim() && !hasExactMatch && (
        <button
          onClick={handleCreateNew}
          style={{
            padding: "10px",
            backgroundColor: "var(--accent-soft)",
            color: "var(--accent)",
            border: `2px dashed var(--accent)`,
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Create New: "{searchQuery}"
        </button>
      )}

      {/* Custom Exercise Section */}
      <div style={{ borderTop: "2px solid var(--border)", paddingTop: "16px", marginTop: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", color: "var(--text)" }}>Custom Exercise</h3>
        </div>

        {/* Create Custom Exercise Button */}
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "12px",
            backgroundColor: "var(--primary-soft, #e3f2fd)",
            color: "var(--primary, #1976d2)",
            border: "1px solid var(--primary, #1976d2)",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          {showCreateForm ? "✕ Close" : "+ Create Custom Exercise"}
        </button>

        {/* Custom Exercise Form (Inline) */}
        {showCreateForm && (
          <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "var(--surface-secondary)", borderRadius: "6px", border: "1px solid var(--border)" }}>
            <CustomExerciseForm
              onCreated={(exercise) => {
                // Refresh list and close form, but don't auto-add to plan
                refreshCustomExercises();
                setShowCreateForm(false);
                // Notify parent so it can update its own available exercises list
                onExerciseCreated?.(exercise);
              }}
            />
          </div>
        )}

        {/* Custom Exercises List */}
        {customExercisesLoading && (
          <div style={{ color: "var(--text-h)", fontSize: "13px" }}>Loading...</div>
        )}

        {!customExercisesLoading && customExercises.length === 0 && (
          <div style={{ color: "var(--text-h)", fontSize: "13px" }}>
            You haven't created any custom exercises yet.
          </div>
        )}

        {!customExercisesLoading && customExercises.map((exercise) => (
          <div
            key={exercise.id}
            style={{
              marginBottom: "12px",
              padding: "10px",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              backgroundColor: "var(--surface-secondary, white)",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            {/* Icon (no thumbnail for custom exercises) */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "4px",
                backgroundColor: "var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-h)",
                fontSize: "20px",
                flexShrink: 0,
              }}
            >
              ⚙️
            </div>

            {/* Info + Button */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: "500",
                  fontSize: "13px",
                  color: "var(--text)",
                  marginBottom: "4px",
                  wordBreak: "break-word",
                }}
              >
                {exercise.name}
              </div>
              {exercise.muscle_group && (
                <div style={{ fontSize: "12px", color: "var(--text-h)", marginBottom: "4px" }}>
                  {exercise.muscle_group}
                </div>
              )}
              {exercise.equipment && (
                <div style={{ fontSize: "11px", color: "var(--text-h)", fontStyle: "italic" }}>
                  {exercise.equipment}
                </div>
              )}
              <button
                onClick={() => handleSelectExercise(exercise.name)}
                style={{
                  marginTop: "6px",
                  padding: "4px 10px",
                  backgroundColor: "var(--success)",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                + Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
