'use client';

import { useCallback, useMemo } from 'react';
import { useMembers } from '@/hooks/useMembers';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { personLabel } from '@/lib/work/people';

export interface Person {
  userId: string;
  name: string;
  email?: string;
  isMe: boolean;
}

/**
 * The people who can be assigned or mentioned on a project: its members only. The member list
 * carries each one's name and email (the API's copy of the SSO identity), so anyone who may view
 * members sees names; nobody needs the role screens for it.
 */
export function useProjectPeople(orgSlug: string, projectId: string) {
  const { can, profile } = useServicePermissions();
  const me = profile?.user_id ?? '';
  const members = useMembers(orgSlug, projectId, can([PERMS.membersView, PERMS.membersManage]));

  const people = useMemo<Person[]>(
    () =>
      (members.data?.data ?? [])
        .filter((m) => !m.left_at)
        .map((m) => {
          const isMe = m.user_id === me;
          return {
            userId: m.user_id,
            name: personLabel({ userId: m.user_id, name: m.name || (isMe ? profile?.name : ''), email: m.email, isMe }),
            email: m.email || undefined,
            isMe,
          };
        })
        .sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name)),
    [members.data, me, profile?.name],
  );

  /** A display name for any user id; a name the API sent with the row (comment, activity) wins. */
  const nameOf = useCallback(
    (userId: string, known?: string) => {
      if (known) return known;
      const p = people.find((x) => x.userId === userId);
      if (p) return p.name;
      return personLabel({ userId, isMe: userId === me, former: true });
    },
    [people, me],
  );

  return { people, nameOf, me, isLoading: members.isLoading };
}
