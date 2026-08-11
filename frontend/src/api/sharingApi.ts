import client from './client';
import publicClient from './publicClient';

export interface ShareGrant {
  username: string;
  display_name: string;
  permission: 'view' | 'log' | 'edit';
}

export interface WorkoutShare {
  id: number;
  token: string;
  mode: 'restricted' | 'anyone';
  link_permission: 'view' | 'log' | 'edit';
  created_at: string;
  revoked_at: string | null;
  grants: ShareGrant[];
}

export interface SharedWithMeEntry {
  plan_id: number;
  plan_name: string;
  token: string;
  owner_username: string;
  permission: 'view' | 'log' | 'edit';
}

export interface SharedPlanExercise {
  exercise_id: number;
  exercise_name: string;
  order_number: number;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: number | null;
  target_duration_seconds: number | null;
  notes?: string;
  video_url?: string | null;
  muscle_group?: string | null;
  equipment?: string | null;
}

export interface SharedPlanDay {
  id: number;
  label: string;
  order_position: number;
  is_rest: boolean;
  exercises: SharedPlanExercise[];
}

export interface SharedPlanWeek {
  week_number: number;
  mode: 'base' | 'linked' | 'custom';
  resolved_week_number?: number;
  days: SharedPlanDay[];
}

export interface SharedPlanInfo {
  id: number;
  user_id: number;
  name: string;
  unit_type: 'days' | 'weeks';
  total_units: number;
  is_quick_start: boolean;
  created_at: string;
  updated_at: string;
}

export interface SharedPlanResponse {
  plan: SharedPlanInfo;
  days: SharedPlanDay[] | null;
  weeks: SharedPlanWeek[] | null;
  permission: 'view' | 'log' | 'edit';
  plan_owner_username: string;
  share: { mode: 'restricted' | 'anyone' };
}

export interface StartWorkoutViaShareRequest {
  plan_day_id: number;
  week_number?: number;
}

export interface StartWorkoutViaShareResponse {
  session_id: number;
  message: string;
}

export interface AddSetViaShareRequest {
  exercise_id: number;
  weight?: number;
  reps?: number;
  duration_seconds?: number;
  notes?: string;
}

export interface AddSetViaShareResponse {
  set_id: number;
  set_number: number;
}

/**
 * Sharing API module.
 * Note: Functions that work with unauthenticated users (getSharedPlan) use publicClient
 * to avoid the 401-redirect interceptor hazard. All other functions use the standard client.
 */
export const sharingApi = {
  // Owner-only endpoints: use standard client with auth
  async createShare(planId: number): Promise<WorkoutShare> {
    const response = await client.post<WorkoutShare>(
      `/workout-plans/${planId}/share`,
      {}
    );
    return response.data;
  },

  async getShare(planId: number): Promise<WorkoutShare> {
    const response = await client.get<WorkoutShare>(
      `/workout-plans/${planId}/share`
    );
    return response.data;
  },

  async updateShare(
    planId: number,
    updates: { mode?: 'restricted' | 'anyone'; link_permission?: 'view' | 'log' | 'edit' }
  ): Promise<WorkoutShare> {
    const response = await client.put<WorkoutShare>(
      `/workout-plans/${planId}/share`,
      updates
    );
    return response.data;
  },

  async revokeShare(planId: number): Promise<WorkoutShare> {
    const response = await client.post<WorkoutShare>(
      `/workout-plans/${planId}/share/revoke`,
      {}
    );
    return response.data;
  },

  // Requires auth (like the other owner-facing functions above) - uses the normal
  // interceptor-bearing client, not publicClient. This is a private "what's shared
  // with me" list, never reachable anonymously.
  async getSharedWithMe(): Promise<SharedWithMeEntry[]> {
    const response = await client.get<SharedWithMeEntry[]>('/shared-with-me');
    return response.data;
  },

  async grantAccess(
    planId: number,
    username: string,
    permission: 'view' | 'log' | 'edit'
  ): Promise<ShareGrant> {
    const response = await client.post<ShareGrant>(
      `/workout-plans/${planId}/share/grants`,
      { username, permission }
    );
    return response.data;
  },

  async revokeAccess(planId: number, username: string): Promise<void> {
    await client.delete(`/workout-plans/${planId}/share/grants/${username}`);
  },

  // Public endpoint: anonymous-capable, uses publicClient without interceptor
  async getSharedPlan(token: string): Promise<SharedPlanResponse> {
    const headers: any = {};
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const response = await publicClient.get<SharedPlanResponse>(
      `/shared/${token}`,
      { headers }
    );
    return response.data;
  },

  // Workout start/log endpoints: anonymous-capable, uses publicClient without interceptor
  async startWorkoutViaShare(
    token: string,
    req: StartWorkoutViaShareRequest
  ): Promise<StartWorkoutViaShareResponse> {
    const headers: any = {};
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const response = await publicClient.post<StartWorkoutViaShareResponse>(
      `/shared/${token}/start`,
      req,
      { headers }
    );
    return response.data;
  },

  async addSetViaShare(
    token: string,
    sessionId: number,
    req: AddSetViaShareRequest
  ): Promise<AddSetViaShareResponse> {
    const headers: any = {};
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const response = await publicClient.post<AddSetViaShareResponse>(
      `/shared/${token}/sessions/${sessionId}/sets`,
      req,
      { headers }
    );
    return response.data;
  },

  async finishWorkoutViaShare(
    token: string,
    sessionId: number
  ): Promise<{ message: string }> {
    const headers: any = {};
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const response = await publicClient.post<{ message: string }>(
      `/shared/${token}/sessions/${sessionId}/finish`,
      {},
      { headers }
    );
    return response.data;
  },
};
