import client from "./client";

export interface Exercise {
  id: number;
  name: string;
  category: string | null;
}

export interface CreateExerciseRequest {
  name: string;
}

export const exercisesApi = {
  async create(name: string, category?: string): Promise<Exercise> {
    const body: any = { name };
    if (category !== undefined) {
      body.category = category;
    }
    const response = await client.post<Exercise>("/exercises", body);
    return response.data;
  },

  async list(): Promise<Exercise[]> {
    const response = await client.get<Exercise[]>("/exercises");
    return response.data;
  },

  async delete(exerciseId: number): Promise<void> {
    await client.delete(`/exercises/${exerciseId}`);
  },
};
