import apiClient from "./client";

export interface LibraryExercise {
  id: number;
  name: string;
  muscle_group: string;
  equipment: string | null;
  thumbnail_url: string | null;
}

export const exerciseLibraryApi = {
  async search(q?: string, muscleGroup?: string): Promise<LibraryExercise[]> {
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (muscleGroup) params.append("muscle_group", muscleGroup);

    const queryString = params.toString();
    const url = queryString ? `/exercise-library?${queryString}` : "/exercise-library";

    const response = await apiClient.get<LibraryExercise[]>(url);
    return response.data;
  },

  async getMuscleGroups(): Promise<string[]> {
    const response = await apiClient.get<{ muscle_groups: string[] }>("/exercise-library/muscle-groups");
    return response.data.muscle_groups;
  },
};
