import client from "./client";

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  video_url: string | null;
  logging_type: string;
  is_custom: boolean;
}

export interface CreateExerciseRequest {
  name: string;
  muscle_group?: string | null;
  equipment?: string | null;
  video_url?: string | null;
  is_custom?: boolean;
}

export interface UpdateExerciseRequest {
  name: string;
  muscle_group?: string | null;
  equipment?: string | null;
  video_url?: string | null;
}

export const exercisesApi = {
  async create(request: CreateExerciseRequest): Promise<Exercise> {
    const body: any = { name: request.name };
    if (request.muscle_group !== undefined) {
      body.muscle_group = request.muscle_group;
    }
    if (request.equipment !== undefined) {
      body.equipment = request.equipment;
    }
    if (request.video_url !== undefined) {
      body.video_url = request.video_url;
    }
    if (request.is_custom !== undefined) {
      body.is_custom = request.is_custom;
    }
    const response = await client.post<Exercise>("/exercises", body);
    return response.data;
  },

  async list(): Promise<Exercise[]> {
    const response = await client.get<Exercise[]>("/exercises");
    return response.data;
  },

  async listCustomOnly(): Promise<Exercise[]> {
    const response = await client.get<Exercise[]>("/exercises?custom_only=true");
    return response.data;
  },

  async update(exerciseId: number, request: UpdateExerciseRequest): Promise<Exercise> {
    const body: any = { name: request.name };
    if (request.muscle_group !== undefined) {
      body.muscle_group = request.muscle_group;
    }
    if (request.equipment !== undefined) {
      body.equipment = request.equipment;
    }
    if (request.video_url !== undefined) {
      body.video_url = request.video_url;
    }
    const response = await client.put<Exercise>(`/exercises/${exerciseId}`, body);
    return response.data;
  },

  async delete(exerciseId: number): Promise<void> {
    await client.delete(`/exercises/${exerciseId}`);
  },
};
