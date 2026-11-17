export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return b64urlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return b64urlEncode(new Uint8Array(hash));
}

export function generateState(): string {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return b64urlEncode(array);
}

function b64urlEncode(array: Uint8Array): string {
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ns keeps two sign-ins in one tab apart: the staff app uses none, the client portal 'portal_', so
// a portal sign-in never consumes the staff app's verifier or the other way round.

export function storeVerifier(verifier: string, ns = '') {
  sessionStorage.setItem(`${ns}pkce_verifier`, verifier);
}

export function consumeVerifier(ns = ''): string | null {
  const v = sessionStorage.getItem(`${ns}pkce_verifier`);
  sessionStorage.removeItem(`${ns}pkce_verifier`);
  return v;
}

export function storeState(state: string, ns = '') {
  sessionStorage.setItem(`${ns}pkce_state`, state);
}

export function consumeState(ns = ''): string | null {
  const s = sessionStorage.getItem(`${ns}pkce_state`);
  sessionStorage.removeItem(`${ns}pkce_state`);
  return s;
}
