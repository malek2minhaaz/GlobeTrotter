import { http } from './api';
import { queryClient, queryKeys } from './queryClient';

/**
 * Global 401 handling.
 *
 * If any request discovers the session is gone — an expired token, or the cookie
 * cleared in another tab — the cached session is dropped so guarded routes
 * redirect to login instead of each screen having to handle it. Login and
 * register are excluded because their 401s are ordinary "wrong password" results.
 */
export function registerSessionInterceptor() {
  http.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      const url: string = error?.config?.url ?? '';
      const isCredentialCheck = url.includes('/auth/login') || url.includes('/auth/register');

      if (status === 401 && !isCredentialCheck) {
        queryClient.setQueryData(queryKeys.auth, null);
      }

      return Promise.reject(error);
    },
  );
}
