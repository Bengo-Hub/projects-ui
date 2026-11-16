'use client';

import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, KeyRound, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { useMe } from '@/hooks/useMe';
import { fieldKeysApi } from '@/lib/api/field-keys';
import {
  canRotate,
  currentShare,
  describeRotation,
  errorCode,
  errorMessage,
  fileNameFrom,
  type FieldKeyHealth,
} from '@/lib/security/field-keys';

const HEALTH_KEY = ['platform', 'field-keys'] as const;

function when(at?: string) {
  return at ? formatDateTime(at) : 'Never';
}

function Fact({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={mono ? 'font-mono text-sm truncate' : 'text-sm truncate'}>{value}</div>
    </div>
  );
}

type Action = 'backup' | 'rotate';

/** The fresh email code step in front of a backup or a rotation. */
function CodeStep({
  action,
  email,
  onDone,
  onCancel,
}: {
  action: Action;
  email: string;
  onDone: (otpToken: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await fieldKeysApi.sendCode();
      setSent(true);
    } catch (e) {
      const status = (e as { status?: number }).status;
      setProblem(status === 429 ? 'Too many codes asked for. Wait a few minutes.' : 'The code could not be sent. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setProblem(null);
    let token: string;
    try {
      token = await fieldKeysApi.verifyCode(code.trim());
    } catch {
      setProblem('That code is wrong or expired.');
      setBusy(false);
      return;
    }
    try {
      await onDone(token);
    } catch (e) {
      setProblem(errorMessage(await errorCode(e)));
    } finally {
      setBusy(false);
      setCode('');
    }
  };

  return (
    <div className="rounded-md border border-border bg-accent/20 p-4 space-y-3">
      <p className="text-sm">
        {action === 'backup'
          ? 'The backup file holds the data keys in the clear. It downloads once per code, nothing is shown on screen, and the download is recorded.'
          : 'Rotating makes a new data key and re-seals every stored value under it. Older keys stay until that is done, then they are retired. Take a backup when it finishes.'}
      </p>
      {!sent ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={send} disabled={busy}>
            Email a code to {email || 'my address'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void confirm();
          }}
        >
          <label className="sr-only" htmlFor="field-key-code">
            Email code
          </label>
          <input
            id="field-key-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 digit code"
            className="h-8 w-36 rounded-md border border-input bg-background px-3 text-sm font-mono"
          />
          <Button size="sm" type="submit" variant={action === 'rotate' ? 'destructive' : 'default'} disabled={busy || !code.trim()}>
            {action === 'backup' ? 'Download backup' : 'Rotate the key'}
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={send} disabled={busy}>
            Send a new code
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </form>
      )}
      {problem && <p className="text-sm text-destructive">{problem}</p>}
    </div>
  );
}

function HealthCard({ h }: { h: FieldKeyHealth }) {
  const share = currentShare(h);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {h.configured ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldAlert className="h-5 w-5 text-destructive" />}
          <CardTitle className="text-base">Key health</CardTitle>
        </div>
        <CardDescription>
          The key projects-api seals QA signer email addresses with. Fingerprints are the first 8 characters of the
          key&apos;s SHA-256; the keys themselves are never shown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Fact label="Root key" value={h.configured ? `Configured (${h.root_fingerprint})` : 'Not configured'} mono={h.configured} />
          <Fact label="Current data key" value={h.current_key_id ? `${h.current_key_id} (${h.current_fingerprint})` : 'None yet, root seals'} mono={!!h.current_key_id} />
          <Fact label="Last backup" value={h.last_backup_at ? `${when(h.last_backup_at)} by ${h.last_backup_by ?? 'unknown'}` : 'Never'} />
          <Fact label="Last rotated" value={when(h.last_rotated_at)} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              {h.sealed_values} sealed value{h.sealed_values === 1 ? '' : 's'}: {h.on_current} on the current key, {h.on_older} on older keys
              {h.on_root > 0 && h.current_key_id ? ` (${h.on_root} still under the root)` : ''}
            </span>
            <span className="font-medium">{share}%</span>
          </div>
          <div className="h-2 rounded-full bg-accent overflow-hidden" role="progressbar" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all" style={{ width: `${share}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">{describeRotation(h)}</p>
        </div>

        {h.keys.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Key</th>
                  <th className="py-2 pr-4 font-medium">Fingerprint</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Values</th>
                </tr>
              </thead>
              <tbody>
                {h.keys.map((k) => (
                  <tr key={k.id} className="border-t border-border">
                    <td className="py-2 pr-4 font-mono">{k.id}</td>
                    <td className="py-2 pr-4 font-mono">{k.fingerprint}</td>
                    <td className="py-2 pr-4">
                      <Badge status={k.status === 'current' ? 'active' : k.status === 'previous' ? 'pending' : 'draft'}>{k.status}</Badge>
                    </td>
                    <td className="py-2 pr-4">{when(k.created_at)}</td>
                    <td className="py-2 pr-4">{k.values}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SecurityKeysPage() {
  const { user, isLoading: meLoading } = useMe();
  const isOwner = !!user?.isPlatformOwner;
  const qc = useQueryClient();
  const [action, setAction] = useState<Action | null>(null);

  const health = useQuery({
    queryKey: HEALTH_KEY,
    queryFn: fieldKeysApi.health,
    enabled: isOwner,
    // Follow a running re-seal.
    refetchInterval: (q) => ((q.state.data as FieldKeyHealth | undefined)?.rotation.state === 'resealing' ? 5000 : false),
  });

  if (!user && meLoading) return <PageLoading />;
  if (!isOwner) {
    return <ErrorBanner message="Security keys are for the platform owner only." />;
  }

  const h = health.data;

  const doBackup = async (token: string) => {
    const { blob, disposition } = await fieldKeysApi.backup(token);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameFrom(disposition);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setAction(null);
    toast.success('Backup downloaded. Keep the file offline; it does not include the root key.');
    await qc.invalidateQueries({ queryKey: HEALTH_KEY });
  };

  const doRotate = async (token: string) => {
    const next = await fieldKeysApi.rotate(token);
    qc.setQueryData(HEALTH_KEY, next);
    setAction(null);
    toast.success('New key is current. Re-sealing has started.');
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="h-6 w-6" /> Security keys
          </span>
        }
        subtitle="Field encryption for projects-api. FIELD_ENCRYPTION_KEY is the root and lives in the cluster secret; the data keys below are kept sealed under it."
        className="mb-0"
      />

      {health.isLoading && <PageLoading />}
      {health.isError && <ErrorBanner message="Key health could not be loaded." />}
      {h && <HealthCard h={h} />}

      {h && h.configured && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backup and rotation</CardTitle>
            <CardDescription>Both need a fresh code emailed to you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {action === null && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setAction('backup')}>
                  <Download className="h-4 w-4" /> Download a backup
                </Button>
                <Button variant="outline" onClick={() => setAction('rotate')} disabled={!canRotate(h)}>
                  <RefreshCw className="h-4 w-4" /> Rotate the key
                </Button>
              </div>
            )}
            {action !== null && (
              <CodeStep
                action={action}
                email={user?.email ?? ''}
                onDone={action === 'backup' ? doBackup : doRotate}
                onCancel={() => setAction(null)}
              />
            )}
            {h.rotation?.state === 'idle' && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                The key has never been rotated, so every value is still sealed under the root key and a backup holds no
                data keys yet. Rotate once, wait for the re-seal to finish, then download a backup.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              The backup holds the data keys, not the root key. Keep the root key&apos;s own backup with the cluster
              secrets. Without the root, the backup still opens every value sealed under its keys.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
