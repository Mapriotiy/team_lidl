export interface ApiErrorDetail {
  code?: string
  message: string
  request_id?: string
  occurred_at?: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: ApiErrorDetail,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected request failure'
}
