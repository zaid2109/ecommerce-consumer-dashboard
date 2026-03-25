export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

export type TokenProvider = () => Promise<string | null>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const backoffDelayMs = (attempt: number) => Math.pow(2, attempt) * 100;

const normalizeError = async (response: Response): Promise<ApiError> => {
  let details: unknown;
  try {
    details = await response.json();
  } catch {
    details = await response.text().catch(() => undefined);
  }
  const message =
    (details && typeof details === "object" && details !== null && "detail" in details
      ? String((details as { detail?: unknown }).detail)
      : response.statusText) ||
    "Request failed";

  return { status: response.status, message, details };
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken?: TokenProvider;

  constructor(opts: { baseUrl?: string; getToken?: TokenProvider } = {}) {
    this.baseUrl = (opts.baseUrl ?? "").replace(/\/$/, "");
    this.getToken = opts.getToken;
  }

  private buildUrl(path: string) {
    if (!path.startsWith("/")) {
      return `${this.baseUrl}/${path}`;
    }
    return `${this.baseUrl}${path}`;
  }

  private async buildHeaders(extra?: HeadersInit): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    if (extra) {
      const extraHeaders = new Headers(extra);
      extraHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    }

    return headers;
  }

  async request<T>(
    path: string,
    init: RequestInit & { retry?: number } = {}
  ): Promise<{ data: T; response: Response }> {
    const retry = init.retry ?? 3;
    const url = this.buildUrl(path);

    for (let attempt = 0; attempt <= retry; attempt++) {
      const headers = await this.buildHeaders(init.headers);
      try {
        const response = await fetch(url, {
          ...init,
          headers,
        });

        if (response.status === 401) {
          if (typeof window !== "undefined") {
            const current = window.location.pathname + window.location.search;
            const locale = window.location.pathname.split("/").filter(Boolean)[0];
            const prefix = locale === "en" || locale === "pl" ? `/${locale}` : "";
            window.location.href = `${prefix}/login?redirect_url=${encodeURIComponent(current)}`;
          }
          throw await normalizeError(response);
        }

        if (!response.ok) {
          throw await normalizeError(response);
        }

        const data = (await response.json()) as T;
        return { data, response };
      } catch (error) {
        // Check if this is an abort error
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        
        const isLast = attempt >= retry;
        const status = (error as ApiError | undefined)?.status;
        const retryable = status === undefined || status >= 500;
        if (isLast || !retryable) {
          throw error;
        }
        await sleep(backoffDelayMs(attempt));
      }
    }

    throw { status: 0, message: "Request failed" } satisfies ApiError;
  }

  get<T>(path: string, init: RequestInit & { retry?: number } = {}) {
    return this.request<T>(path, { ...init, method: "GET" });
  }

  post<T>(path: string, body?: unknown, init: RequestInit & { retry?: number } = {}) {
    if (body instanceof FormData) {
      return this.request<T>(path, {
        ...init,
        method: "POST",
        body,
      });
    }
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return this.request<T>(path, {
      ...init,
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  postForm<T>(path: string, form: FormData, init: RequestInit & { retry?: number } = {}) {
    return this.request<T>(path, {
      ...init,
      method: "POST",
      body: form,
    });
  }

  put<T>(path: string, body?: unknown, init: RequestInit & { retry?: number } = {}) {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return this.request<T>(path, {
      ...init,
      method: "PUT",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  delete<T>(path: string, init: RequestInit & { retry?: number } = {}) {
    return this.request<T>(path, { ...init, method: "DELETE" });
  }
}
