import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/** The body with the answer's headers, names lower-cased (Idempotent-Replayed). */
function withHeaders<T>(r: AxiosResponse<T>): { data: T; headers: Record<string, string> } {
  return {
    data: r.data,
    headers: Object.fromEntries(Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)])),
  };
}

class ApiClient {
  private instance: AxiosInstance;
  private accessToken: string | null = null;
  private tenantId: string | null = null;
  private tenantSlug: string | null = null;
  private platformOwner = false;
  private on401Callback: (() => void) | null = null;
  private onSubscription403Callback: ((data: unknown) => void) | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    this.instance.interceptors.request.use(this.handleRequest);
    this.instance.interceptors.response.use(
      (res: AxiosResponse) => res,
      this.handleError
    );
  }

  private handleRequest = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    if (this.accessToken) {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
    }
    if (!this.platformOwner) {
      if (this.tenantId) config.headers['X-Tenant-ID'] = this.tenantId;
      if (this.tenantSlug) config.headers['X-Tenant-Slug'] = this.tenantSlug;
    }
    return config;
  };

  private handleError = async (error: unknown): Promise<never> => {
    const axiosError = error as {
      response?: { status?: number; data?: unknown };
      config?: InternalAxiosRequestConfig & { _retried?: boolean };
    };

    // The service auth/me can answer 401 while the user is still being provisioned (JIT); it never
    // signs anyone out (SSO guide step 5).
    const isServiceMe = /\/auth\/me$/.test(axiosError.config?.url ?? '');

    if (axiosError.response?.status === 401 && isServiceMe) {
      return Promise.reject(error);
    }

    if (axiosError.response?.status === 401 && !axiosError.config?._retried) {
      if (this.accessToken) {
        try {
          const sent = String(axiosError.config?.headers?.Authorization ?? '').replace(/^Bearer\s+/i, '');
          const { refreshAccessToken } = await import('@/lib/auth/token-refresh');
          const newToken = await refreshAccessToken(sent || this.accessToken);
          if (newToken && axiosError.config) {
            this.accessToken = newToken;
            axiosError.config._retried = true;
            axiosError.config.headers = axiosError.config.headers ?? {};
            axiosError.config.headers.Authorization = `Bearer ${newToken}`;
            return this.instance.request(axiosError.config) as Promise<never>;
          }
        } catch {
          // token refresh failed
        }
        this.on401Callback?.();
      }
    } else if (axiosError.response?.status === 401 && axiosError.config?._retried) {
      // Even a freshly renewed token was refused: the session is unusable, so send the person
      // to sign in instead of leaving a page where every save fails.
      this.on401Callback?.();
    }

    if (axiosError.response?.status === 403) {
      const data = axiosError.response.data as { code?: string; upgrade?: boolean } | undefined;
      if (data?.code === 'subscription_inactive' || data?.upgrade === true) {
        this.onSubscription403Callback?.(data);
      }
    }

    return Promise.reject(error);
  };

  public setAccessToken(token: string | null) { this.accessToken = token; }
  public setTenantInfo(id: string | null, slug: string | null) {
    this.tenantId = id;
    this.tenantSlug = slug;
  }
  public setPlatformOwner(val: boolean) { this.platformOwner = val; }
  public setOn401(cb: (() => void) | null) { this.on401Callback = cb; }
  public setOnSubscription403(cb: ((data: unknown) => void) | null) { this.onSubscription403Callback = cb; }

  public get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    return this.instance.get<T>(url, { params }).then((r: AxiosResponse<T>) => r.data);
  }
  /** A binary download (a PDF report, for example) with the same auth and tenant headers. */
  public getBlob(url: string, params?: Record<string, unknown>): Promise<Blob> {
    return this.instance
      .get<Blob>(url, { params, responseType: 'blob', timeout: 60000 })
      .then((r: AxiosResponse<Blob>) => r.data);
  }
  /** A POST whose answer is a file; returns it with its Content-Disposition header. */
  public postBlob(url: string, data?: unknown): Promise<{ blob: Blob; disposition: string | null }> {
    return this.instance
      .post<Blob>(url, data, { responseType: 'blob', timeout: 60000 })
      .then((r: AxiosResponse<Blob>) => ({
        blob: r.data,
        disposition: (r.headers['content-disposition'] as string | undefined) ?? null,
      }));
  }
  public post<T>(url: string, data?: unknown): Promise<T> {
    return this.instance.post<T>(url, data).then((r: AxiosResponse<T>) => r.data);
  }
  public put<T>(url: string, data?: unknown): Promise<T> {
    return this.instance.put<T>(url, data).then((r: AxiosResponse<T>) => r.data);
  }
  public patch<T>(url: string, data?: unknown): Promise<T> {
    return this.instance.patch<T>(url, data).then((r: AxiosResponse<T>) => r.data);
  }
  /** A PATCH with extra headers (an Idempotency-Key) that also returns the answer's headers. */
  public patchWithHeaders<T>(
    url: string,
    data: unknown,
    headers: Record<string, string>,
  ): Promise<{ data: T; headers: Record<string, string> }> {
    return this.instance.patch<T>(url, data, { headers }).then(withHeaders);
  }
  /**
   * A POST with extra headers (an Idempotency-Key) that also returns the answer's headers. timeoutMs
   * overrides the 15 second default (AI drafts can take longer).
   */
  public postWithHeaders<T>(
    url: string,
    data: unknown,
    headers: Record<string, string>,
    timeoutMs?: number,
  ): Promise<{ data: T; headers: Record<string, string> }> {
    return this.instance.post<T>(url, data, { headers, ...(timeoutMs ? { timeout: timeoutMs } : {}) }).then(withHeaders);
  }

  /**
   * Reads a Server-Sent Events stream with the same auth and tenant headers as every other call
   * (EventSource cannot send an Authorization header). onEvent gets each event's name and data.
   * Resolves when the server ends the stream; a 401 refreshes the token once and reopens.
   */
  public async stream(url: string, onEvent: (event: string, data: string) => void, signal?: AbortSignal): Promise<void> {
    const { parseSSE } = await import('@/lib/work/sse');
    const open = () => {
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
      if (!this.platformOwner) {
        if (this.tenantId) headers['X-Tenant-ID'] = this.tenantId;
        if (this.tenantSlug) headers['X-Tenant-Slug'] = this.tenantSlug;
      }
      return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}${url}`, { headers, signal, cache: 'no-store' });
    };
    let res = await open();
    if (res.status === 401 && this.accessToken) {
      const { refreshAccessToken } = await import('@/lib/auth/token-refresh');
      const newToken = await refreshAccessToken(this.accessToken);
      if (!newToken) {
        this.on401Callback?.();
        throw Object.assign(new Error('unauthorized'), { status: 401 });
      }
      this.accessToken = newToken;
      res = await open();
    }
    if (!res.ok || !res.body) {
      throw Object.assign(new Error(`stream failed (${res.status})`), { status: res.status });
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSSE(buffer);
      buffer = parsed.rest;
      for (const m of parsed.messages) onEvent(m.event, m.data);
    }
  }
  public delete<T>(url: string): Promise<T> {
    return this.instance.delete<T>(url).then((r: AxiosResponse<T>) => r.data);
  }
}

export const apiClient = new ApiClient();
