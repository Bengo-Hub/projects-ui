import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

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

    if (axiosError.response?.status === 401 && !axiosError.config?._retried) {
      if (this.accessToken) {
        try {
          const { refreshAccessToken } = await import('@/lib/auth/token-refresh');
          const newToken = await refreshAccessToken();
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
  public post<T>(url: string, data?: unknown): Promise<T> {
    return this.instance.post<T>(url, data).then((r: AxiosResponse<T>) => r.data);
  }
  public put<T>(url: string, data?: unknown): Promise<T> {
    return this.instance.put<T>(url, data).then((r: AxiosResponse<T>) => r.data);
  }
  public patch<T>(url: string, data?: unknown): Promise<T> {
    return this.instance.patch<T>(url, data).then((r: AxiosResponse<T>) => r.data);
  }
  public delete<T>(url: string): Promise<T> {
    return this.instance.delete<T>(url).then((r: AxiosResponse<T>) => r.data);
  }
}

export const apiClient = new ApiClient();
