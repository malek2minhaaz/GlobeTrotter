import { api } from '@/lib/api';
import type { ProfileResponse, UserProfile } from '@/types/api';

/** Authentication, profile and account settings. */

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  avatar?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface ForgotPasswordResult {
  delivered: boolean;
  message: string;
  developmentResetToken?: string;
  developmentResetUrl?: string;
  expiresAt?: string | null;
}

export const authService = {
  register: (payload: RegisterPayload) =>
    api.post<{ user: UserProfile }>('/auth/register', payload),

  login: (payload: LoginPayload) => api.post<{ user: UserProfile }>('/auth/login', payload),

  logout: () => api.post<{ success: boolean }>('/auth/logout'),

  me: () => api.get<{ user: UserProfile }>('/auth/me'),

  forgotPassword: (email: string) =>
    api.post<ForgotPasswordResult>('/auth/forgot-password', { email }),

  resetPassword: (payload: { token: string; password: string; confirmPassword: string }) =>
    api.post<{ success: boolean; message: string }>('/auth/reset-password', payload),

  changePassword: (payload: {
    currentPassword: string;
    password: string;
    confirmPassword: string;
  }) => api.post<{ success: boolean }>('/auth/change-password', payload),
};

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  avatar?: string | null;
  language?: string;
  currency?: string;
}

export interface UpdatePreferencesPayload {
  theme?: 'light' | 'dark' | 'system';
  tripsPublicByDefault?: boolean;
  notifyUpcomingTrips?: boolean;
  notifyBudgetAlerts?: boolean;
  notifyItineraryConflicts?: boolean;
}

export const profileService = {
  get: () => api.get<ProfileResponse>('/profile'),

  update: (payload: UpdateProfilePayload) =>
    api.put<{ profile: UserProfile }>('/profile', payload),

  updatePreferences: (payload: UpdatePreferencesPayload) =>
    api.put<{ profile: UserProfile }>('/profile/preferences', payload),

  deleteAccount: (payload: { password: string; confirmation: string }) =>
    api.delete<{ success: boolean }>('/profile', { data: payload }),
};
