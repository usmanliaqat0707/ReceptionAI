export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
  requestId?: string;
}

export class ApiException extends Error {
  constructor(
    public status: number,
    public error: ApiError
  ) {
    super(error.message);
    this.name = "ApiException";
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : endpoint;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error: ApiError = json.error || {
      code: "API_ERROR",
      message: res.statusText || "An unexpected error occurred",
    };
    throw new ApiException(res.status, error);
  }

  return json.data as T;
}
