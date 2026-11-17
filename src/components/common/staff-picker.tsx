'use client';

import { useMemo } from 'react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { useStaffPeople } from '@/hooks/useRbac';
import { rbacApi, type PickPerson } from '@/lib/api/rbac';

export function personOption(p: PickPerson): ComboboxOption {
  return { value: p.user_id, label: p.name || p.email || 'Not signed in yet', description: p.name && p.email ? p.email : undefined };
}

/**
 * Picks one of the organisation's staff by name or email from `GET /people` (never a raw id, never
 * a portal client). People already in `exclude` are not offered. The caller needs one of the
 * permissions /people takes: members.manage, rbac.manage or tenders.manage.
 */
export function StaffPicker({
  orgSlug,
  value,
  onChange,
  exclude = [],
  enabled = true,
  className,
}: {
  orgSlug: string;
  value: string;
  onChange: (userId: string) => void;
  exclude?: readonly string[];
  enabled?: boolean;
  className?: string;
}) {
  const staff = useStaffPeople(orgSlug, enabled);
  const options = useMemo(
    () => (staff.data ?? []).filter((p) => !exclude.includes(p.user_id)).map(personOption),
    [staff.data, exclude],
  );
  return (
    <SearchableCombobox
      options={options}
      value={value}
      onChange={(v) => onChange(v || '')}
      onRemoteSearch={async (q) => (await rbacApi.people(orgSlug, q)).filter((p) => !exclude.includes(p.user_id)).map(personOption)}
      loading={staff.isLoading}
      placeholder="Choose a person"
      searchPlaceholder="Search by name or email"
      emptyText="Nobody matches. Invite them from Team first."
      className={className}
    />
  );
}
