import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { FieldErrors, Paginated } from '@/types/api';

/**
 * API client.
 *
 * The server always answers in one of two envelopes — `{ data }` for a single
 * resource or `{ data, meta }` for a list — and `{ error: { message, code,
 * details } }` for failures. This module owns that unwrapping so no component
 * ever touches an `AxiosResponse`.
 */

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

/** A normalised API failure the UI can render directly. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldErrors;
  readonly details: unknown;

  constructor(
    message: string,
    options: { status?: number; code?: string; fieldErrors?: FieldErrors; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.code = options.code ?? 'UNKNOWN';
    this.fieldErrors = options.fieldErrors ?? {};
    this.details = options.details;
  }

  get isValidationError() {
    return this.status === 422;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isNotFound() {
    return this.status === 404;
  }

  /** True when the request never reached the server. */
  get isNetworkError() {
    return this.status === 0;
  }
}

/**
 * Turns anything axios throws into an `ApiError` with a message safe to show a
 * user. Server messages are already user-facing; anything else falls back to a
 * friendly line so a stack trace can never leak into the UI.
 */
function normaliseError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    if (!error.response) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      return new ApiError(
        offline
          ? 'You appear to be offline. Check your connection and try again.'
          : 'We could not reach the server. Please try again in a moment.',
        { code: offline ? 'OFFLINE' : 'NETWORK_ERROR' },
      );
    }

    const { status, data } = error.response;
    const payload = data as
      | { error?: { message?: string; code?: string; details?: unknown } }
      | undefined;
    const message = payload?.error?.message ?? 'Something went wrong. Please try again.';
    const code = payload?.error?.code ?? 'ERROR';
    const details = payload?.error?.details;

    // 422 bodies carry per-field messages; surface them on the right inputs.
    const fieldErrors =
      status === 422 && details && typeof details === 'object' && !Array.isArray(details)
        ? (details as FieldErrors)
        : {};

    return new ApiError(message, { status, code, fieldErrors, details });
  }

  return new ApiError('Something went wrong. Please try again.');
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await http.request<{ data: T }>(config);
    return response.data?.data as T;
  } catch (error) {
    throw normaliseError(error);
  }
}

/** A list request keeps its pagination metadata alongside the rows. */
async function requestList<T>(config: AxiosRequestConfig): Promise<Paginated<T>> {
  try {
    const response = await http.request<{ data: T[]; meta: Paginated<T>['meta'] }>(config);
    return {
      data: response.data?.data ?? [],
      meta: response.data?.meta ?? { page: 1, pageSize: 12, total: 0, totalPages: 1 },
    };
  } catch (error) {
    throw normaliseError(error);
  }
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, url, method: 'get' }),
  getList: <T>(url: string, config?: AxiosRequestConfig) =>
    requestList<T>({ ...config, url, method: 'get' }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: 'post', data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: 'put', data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: 'patch', data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: 'delete' }),
};

/** Strips empty values so query strings stay clean and validators stay happy. */
export function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export { normaliseError as toApiError };
