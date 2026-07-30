import React, { useState, useEffect, useRef } from "react";
import type { Exercise } from "../../api/exercisesApi";
import { exercisesApi } from "../../api/exercisesApi";
import { exerciseLibraryApi } from "../../api/exerciseLibraryApi";
import type { LibraryExercise } from "../../api/exerciseLibraryApi";
import { CustomExerciseForm } from "./CustomExerciseForm";
import { useToast } from "../../components/Toast";

interface ExerciseLibrarySidebarProps {
  onSelectExercise: (name: string) => void;
  onExerciseCreated?: (exercise: Exercise) => void;
}

type TabType = "library" | "custom";

export const ExerciseLibrarySidebar: React.FC<ExerciseLibrarySidebarProps> = ({
  onSelectExercise,
  onExerciseCreated,
}) => {
  const { showToast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("library");

  // Library tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [results, setResults] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Custom exercises state
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customInitialLoading, setCustomInitialLoading] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Load custom exercises when switching to custom tab
  const loadCustomExercises = async () => {
    setCustomLoading(true);
    try {
      const exercises = await exercisesApi.list();
      setCustomExercises(exercises);
    } catch (error) {
      console.error("Failed to load custom exercises:", error);
      showToast("Failed to load custom exercises", "error");
    } finally {
      setCustomLoading(false);
    }
  };

  // Load custom exercises once on first tab switch
  useEffect(() => {
    if (activeTab === "custom" && !customInitialLoading) {
      setCustomInitialLoading(true);
      loadCustomExercises();
    }
  }, [activeTab, customInitialLoading]);

  // Debounced search for library
  useEffect(() => {
    if (activeTab !== "library") return;

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
  }, [searchQuery, selectedMuscleGroup, activeTab]);

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

  const handleDeleteExercise = async (exerciseId: number) => {
    try {
      await exercisesApi.delete(exerciseId);
      setCustomExercises(customExercises.filter((e) => e.id !== exerciseId));
      showToast("Exercise deleted", "success");
    } catch (error: any) {
      const message = error?.response?.data?.error || "Failed to delete exercise";
      showToast(message, "error");
    }
  };

  const handleFormSaved = async (exercise: Exercise) => {
    setShowCustomForm(false);
    setEditingExercise(null);
    await loadCustomExercises();
    // Notify parent of newly created/edited exercise so it can update its cache
    if (onExerciseCreated) {
      onExerciseCreated(exercise);
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
      {/* Tab Bar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setActiveTab("library")}
          style={{
            padding: "10px 16px",
            backgroundColor: activeTab === "library" ? "var(--surface)" : "transparent",
            color: activeTab === "library" ? "var(--accent)" : "var(--text-h)",
            border: "none",
            borderBottom: activeTab === "library" ? "2px solid var(--accent)" : "2px solid transparent",
            fontSize: "14px",
            fontWeight: activeTab === "library" ? "600" : "500",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          Exercise Library
        </button>
        <button
          onClick={() => setActiveTab("custom")}
          style={{
            padding: "10px 16px",
            backgroundColor: activeTab === "custom" ? "var(--surface)" : "transparent",
            color: activeTab === "custom" ? "var(--accent)" : "var(--text-h)",
            border: "none",
            borderBottom: activeTab === "custom" ? "2px solid var(--accent)" : "2px solid transparent",
            fontSize: "14px",
            fontWeight: activeTab === "custom" ? "600" : "500",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          Custom Exercises
        </button>
      </div>

      {/* LIBRARY TAB - render only when active */}
      {activeTab === "library" && (
        <>
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

            {!loading &&
              results.map((exercise) => (
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
        </>
      )}

      {/* CUSTOM EXERCISES TAB - render only when active */}
      {activeTab === "custom" && (
        <>
          {showCustomForm ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <CustomExerciseForm
                mode={editingExercise ? "edit" : "create"}
                initialValues={
                  editingExercise
                    ? {
                        id: editingExercise.id,
                        name: editingExercise.name,
                        muscle_group: editingExercise.muscle_group,
                        equipment: editingExercise.equipment,
                        video_url: editingExercise.video_url,
                      }
                    : undefined
                }
                onSaved={handleFormSaved}
                onCancel={() => {
                  setShowCustomForm(false);
                  setEditingExercise(null);
                }}
              />
            </div>
          ) : (
            <>
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
                {customLoading && (
                  <div style={{ color: "var(--text-h)", fontSize: "13px" }}>Loading...</div>
                )}

                {!customLoading && customExercises.length === 0 && (
                  <div style={{ color: "var(--text-h)", fontSize: "13px" }}>
                    You haven't created any custom exercises yet.
                  </div>
                )}

                {!customLoading &&
                  customExercises.map((exercise) => (
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
                      {/* Placeholder Icon */}
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

                      {/* Info + Buttons */}
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
                          {exercise.muscle_group || "—"}
                        </div>
                        {exercise.equipment && (
                          <div style={{ fontSize: "11px", color: "var(--text-h)", fontStyle: "italic" }}>
                            {exercise.equipment}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                          <button
                            onClick={() => handleSelectExercise(exercise.name)}
                            style={{
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
                          <button
                            onClick={() => {
                              setEditingExercise(exercise);
                              setShowCustomForm(true);
                            }}
                            style={{
                              padding: "4px 10px",
                              backgroundColor: "var(--border)",
                              color: "var(--text)",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "12px",
                              cursor: "pointer",
                              fontWeight: "500",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteExercise(exercise.id)}
                            style={{
                              padding: "4px 10px",
                              backgroundColor: "var(--danger-soft)",
                              color: "var(--danger)",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "12px",
                              cursor: "pointer",
                              fontWeight: "500",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Add Custom Exercise Button */}
              {!customLoading && (
                <button
                  onClick={() => {
                    setEditingExercise(null);
                    setShowCustomForm(true);
                  }}
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
                  + Add Custom Exercise
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
