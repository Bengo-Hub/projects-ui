'use client';

import { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { emailCodeApi, errorText, httpStatus, qaInviteeApi } from '@/lib/api/qa-invitee';
import { useAuthStore } from '@/store/auth';
import { useQAGrant } from '@/hooks/useQAInvitee';
import { Field, inputClass } from './fields';

const DENIED = 'This address cannot open the session. Check it is the address the invitation was sent to.';

/**
 * How an invitee gets in: a signed-in account whose email holds the invite (SSO), or an email code
 * from auth-api traded once for access. Every refusal reads the same, as the API's does.
 */
export function InviteeAccess({ code, tenantSlug }: { code: string; tenantSlug?: string }) {
  const grant = useQAGrant(code);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const signedIn = !!session?.accessToken && !!user?.email && (!session.expiresAt || Date.parse(session.expiresAt) > Date.now());

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function viaSSO() {
    if (!session?.accessToken) return;
    setBusy(true);
    setError(null);
    try {
      grant(await qaInviteeApi.accessBySSO(code, session.accessToken));
    } catch (err) {
      setError(httpStatus(err) === 403 || httpStatus(err) === 401 ? `${user?.email} is not invited to this session. Use the email code instead.` : errorText(err, 'Sign in did not work. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await emailCodeApi.send(addr, tenantSlug);
      setStep('code');
      setNotice(`If ${addr} is invited, a 6 digit code is on its way. It lasts 10 minutes.`);
    } catch (err) {
      setError(httpStatus(err) === 429 ? 'Too many codes were asked for. Wait a few minutes and try again.' : errorText(err, 'The code could not be sent. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6 digit code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { otp_token } = await emailCodeApi.verify(email.trim(), otp.trim());
      grant(await qaInviteeApi.accessByEmail(code, otp_token));
    } catch (err) {
      const s = httpStatus(err);
      setError(s === 403 ? DENIED : errorText(err, 'The code did not work. Check it or ask for a new one.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Open the acceptance session</CardTitle>
        <p className="text-sm text-muted-foreground">Prove the email address you were invited with.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {signedIn && (
          <div className="space-y-2">
            <Button className="h-11 w-full" onClick={() => void viaSSO()} disabled={busy}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Continue as {user?.email}
            </Button>
            <p className="text-center text-xs text-muted-foreground">or use an email code</p>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-3" noValidate>
            <Field label="Email address" error={error}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className={inputClass}
                  value={email}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" variant={signedIn ? 'outline' : 'default'} className="h-11 w-full" disabled={busy}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Sending...' : 'Email me a code'}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3" noValidate>
            {notice && (
              <p role="status" className="text-sm text-muted-foreground">
                {notice}
              </p>
            )}
            <Field label="Code" error={error}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  className={`${inputClass} tracking-[0.4em]`}
                  value={otp}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              )}
            </Field>
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy ? 'Checking...' : 'Open the session'}
            </Button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <Button type="button" variant="link" className="px-0" onClick={() => void sendCode()} disabled={busy}>
                Send a new code
              </Button>
              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError(null);
                }}
              >
                Use another address
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
