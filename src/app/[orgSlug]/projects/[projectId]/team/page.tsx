'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Plus, Users, Trash2 } from 'lucide-react';
import { useMembers, useAddMember, useRemoveMember } from '@/hooks/useMembers';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import type { AddMemberInput } from '@/lib/api/members';

function AddMemberModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: AddMemberInput) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<AddMemberInput>({ user_id: '', role_code: 'member' });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.user_id.trim()) return;
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">Add Member</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">User ID *</label>
            <input
              type="text"
              value={form.user_id}
              onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="User ID"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={form.role_code}
              onChange={(e) => setForm((f) => ({ ...f, role_code: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !form.user_id.trim()}>
              {isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, isError } = useMembers(orgSlug, projectId);
  const addMember = useAddMember(orgSlug, projectId);
  const removeMember = useRemoveMember(orgSlug, projectId);

  const members = data?.data ?? [];

  function handleAdd(input: AddMemberInput) {
    addMember.mutate(input, { onSuccess: () => setShowAdd(false) });
  }

  if (isLoading) return <PageLoading />;
  if (isError) return <ErrorBanner message="Failed to load team members." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Team ({members.length})</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description="Add people to collaborate on this project."
          action={
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Add Member
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-left font-medium text-muted-foreground">User ID</th>
                  <th className="py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="py-3 text-left font-medium text-muted-foreground">Joined</th>
                  <th className="py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-accent/20">
                    <td className="py-3 font-mono text-xs text-muted-foreground">{m.user_id}</td>
                    <td className="py-3">
                      <span className="capitalize rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                        {m.role_code}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {format(new Date(m.joined_at), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => removeMember.mutate(m.user_id)}
                        disabled={removeMember.isPending}
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onSubmit={handleAdd}
          isPending={addMember.isPending}
        />
      )}
    </div>
  );
}
