import client from "./client";

export interface Exercise {
  id: number;
  name: string;
  category: string | null;
  logging_type: string;
}

export interface CreateExerciseRequest {
  name: string;
}

export const exercisesApi = {
  async create(name: string, category?: string, loggingType?: string): Promise<Exercise> {
    const body: any = { name };
    if (category !== undefined) {
      body.category = category;
    }
    if (loggingType !== undefined) {
      body.logging_type = loggingType;
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
