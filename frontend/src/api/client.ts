import { ApiError, type ApiErrorDetail } from './errors'

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

async function failure(response: Response): Promise<ApiError> {
  let detail: unknown
  try { detail = await response.json() } catch { detail = undefined }
  const nested = typeof detail === 'object' && detail !== null && 'detail' in detail ? detail.detail : detail
  const structured = typeof nested === 'object' && nested !== null ? nested as Partial<ApiErrorDetail> : undefined
  const message = structured?.message ?? (typeof nested === 'string' ? nested : `Request failed (${response.status})`)
  return new ApiError(message, response.status, structured?.message ? structured as ApiErrorDetail : undefined)
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (!response.ok) throw await failure(response)
  return response.json() as Promise<T>
}

export async function apiDownload(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, { signal })
  if (!response.ok) throw await failure(response)
  return response.blob()
}

export function queryString(values: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}
