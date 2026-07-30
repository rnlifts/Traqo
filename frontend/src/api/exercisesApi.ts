import client from "./client";

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  video_url: string | null;
  logging_type: string;
}

export interface CreateExerciseRequest {
  name: string;
  muscle_group?: string;
  equipment?: string;
  video_url?: string;
  logging_type?: string;
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
    if (request.logging_type !== undefined) {
      body.logging_type = request.logging_type;
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

  async getEquipmentOptions(): Promise<string[]> {
    const response = await client.get<{ equipment_options: string[] }>(
      "/exercise-library/equipment"
    );
    return response.data.equipment_options;
  },
};
