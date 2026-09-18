import { api, toQueryString } from '@/lib/api';
import type { AdminAnalytics, AppNotification, Dashboard, UploadConfig } from '@/types/api';

/** Dashboard hub, derived notifications, admin analytics and uploads. */

export const dashboardService = {
  get: () => api.get<Dashboard>('/dashboard'),
  notifications: (limit = 8) => api.get<AppNotification[]>(`/dashboard/notifications${toQueryString({ limit })}`),
};

export const adminService = {
  analytics: () => api.get<AdminAnalytics>('/admin/analytics'),
};

export const uploadService = {
  config: () => api.get<UploadConfig>('/uploads/config'),

  /**
   * Images may be a pasted URL or an inline data URL read from a file. Inline
   * uploads mean the app works with no storage provider configured.
   */
  create: (payload: { url?: string; dataUrl?: string }) =>
    api.post<{ url: string; source: string; provider: string }>('/uploads', payload),
};
