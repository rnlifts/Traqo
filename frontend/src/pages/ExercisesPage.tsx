import React, { useState } from "react";
import { CreateExerciseForm } from "../features/exercises/CreateExerciseForm";
import { ExerciseList } from "../features/exercises/ExerciseList";
import { Layout } from "../components/Layout";

export const ExercisesPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <Layout>
      <div style={{ padding: "20px" }}>
        <h1>Exercises</h1>

        <CreateExerciseForm onCreated={handleCreated} />

        <h2>My Exercises</h2>
        <ExerciseList key={refreshKey} onDeleted={handleCreated} />
      </div>
    </Layout>
  );
};
