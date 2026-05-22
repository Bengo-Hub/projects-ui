const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_URL || 'https://sso.codevertexitsolutions.com';
const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID || 'projects-ui';

export interface AuthorizeParams {
  codeChallenge: string;
  state: string;
  redirectUri: string;
  scope?: string;
  tenant?: string;
}

export interface TokenExchangeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export function buildAuthorizeUrl({ codeChallenge, state, redirectUri, scope, tenant: tenantParam }: AuthorizeParams): string {
  const url = new URL('/api/v1/authorize', SSO_BASE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', SSO_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scope || 'openid profile email offline_access');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  const tenant = tenantParam ?? (typeof window !== 'undefined' ? localStorage.getItem('tenantSlug') : null);
  if (tenant) {
    url.searchParams.set('tenant', tenant);
  }

  return url.toString();
}

export function buildLogoutUrl(postLogoutRedirectUri?: string): string {
  const url = new URL('/api/v1/auth/logout', SSO_BASE_URL);
  if (postLogoutRedirectUri) {
    url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
  }
  return url.toString();
}

export async function exchangeCodeForTokens(params: TokenExchangeParams) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: SSO_CLIENT_ID,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(`${SSO_BASE_URL}/api/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as Record<string, string>;
    throw new Error(errorData.error_description || errorData.error || 'Token exchange failed');
  }

  return response.json();
}

export async function refreshTokens(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const response = await fetch(`${SSO_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken, client_id: SSO_CLIENT_ID }),
  });
  if (!response.ok) throw new Error('Token refresh failed');
  return response.json();
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  tenant_id: string;
  tenant_slug: string;
  isPlatformOwner: boolean;
  isSuperUser: boolean;
  tenant?: Record<string, unknown>;
}

export async function fetchProfile(accessToken?: string): Promise<UserProfile> {
  const token = accessToken ?? (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${SSO_BASE_URL}/api/v1/auth/me`, { headers });
  if (!res.ok) {
    const err = new Error(res.status === 401 ? 'Unauthorized' : 'SSO /me failed') as Error & { response?: { status: number } };
    err.response = { status: res.status };
    throw err;
  }
  const data = await res.json() as Record<string, unknown>;
  const roles: string[] = Array.isArray(data.roles) ? (data.roles as string[]) : [];
  return {
    id: (data.id as string) ?? '',
    email: (data.email as string) ?? '',
    fullName: ((data.fullName || data.full_name || data.email) as string) ?? '',
    roles,
    permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : [],
    tenant_id: (data.tenant_id as string) ?? '',
    tenant_slug: (data.tenant_slug as string) ?? '',
    isPlatformOwner: data.is_platform_owner === true || (data.tenant_slug as string) === 'codevertex',
    isSuperUser: roles.includes('superuser'),
    tenant: data.tenant as Record<string, unknown> | undefined,
  };
}
