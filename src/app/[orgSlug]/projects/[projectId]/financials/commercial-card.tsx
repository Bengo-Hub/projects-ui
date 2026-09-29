'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateProject } from '@/hooks/useProjects';
import { projectsApi, type LookupOption } from '@/lib/api/projects';
import type { BillingType, Commercial } from '@/lib/api/financials';
import { formatCurrency } from '@/lib/utils';

const billingLabel: Record<BillingType, string> = {
  fixed: 'Fixed price',
  time_and_materials: 'Time and materials',
  non_billable: 'Internal (not billed)',
};

const toOption = (o: LookupOption): ComboboxOption => ({ value: o.id, label: o.name, hint: o.detail });

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

/**
 * The project's contract: how it is billed, the agreed value, the client (a CRM contact) and the
 * cost centre its spend belongs to, with the margin those terms imply.
 */
export function CommercialCard({
  orgSlug,
  projectId,
  commercial,
  currency,
}: {
  orgSlug: string;
  projectId: string;
  commercial: Commercial;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const c = commercial;
  const margin = c.projected_margin;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contract</CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" /> Edit terms
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <CommercialForm
            orgSlug={orgSlug}
            projectId={projectId}
            commercial={c}
            onDone={() => setEditing(false)}
          />
        ) : !c.billing_type ? (
          <p className="text-sm text-muted-foreground">
            No contract terms yet. Set how the project is billed and its agreed value to see the margin it is heading for.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-xs text-muted-foreground">Billing</p>
              <p className="font-semibold">{billingLabel[c.billing_type]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-semibold">{c.client_name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cost centre</p>
              <p className="font-semibold">{c.cost_center_name || '-'}</p>
            </div>
            {c.billing_type === 'fixed' && (
              <div>
                <p className="text-xs text-muted-foreground">Contract value</p>
                <p className="font-semibold">{c.contract_value != null ? formatCurrency(c.contract_value, currency) : 'Not set'}</p>
              </div>
            )}
            {c.billing_type !== 'non_billable' && (
              <div>
                <p className="text-xs text-muted-foreground">Invoiced</p>
                <p className="font-semibold">{formatCurrency(c.invoiced, currency)}</p>
                {c.unbilled != null && <p className="text-xs text-muted-foreground">{formatCurrency(c.unbilled, currency)} still to bill</p>}
              </div>
            )}
            {margin != null && (
              <div>
                <p className="text-xs text-muted-foreground">
                  {c.margin_basis === 'at_completion' ? 'Margin at completion' : 'Margin to date'}
                </p>
                <p className={`font-semibold ${margin < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatCurrency(margin, currency)}
                  {c.projected_margin_pct != null && <span className="ml-1 text-xs">({c.projected_margin_pct.toFixed(1)}%)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.margin_basis === 'at_completion' ? 'Contract value less forecast cost' : 'Invoiced less cost'}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommercialForm({
  orgSlug,
  projectId,
  commercial,
  onDone,
}: {
  orgSlug: string;
  projectId: string;
  commercial: Commercial;
  onDone: () => void;
}) {
  const update = useUpdateProject(orgSlug);
  const [billing, setBilling] = useState<BillingType | ''>(commercial.billing_type ?? '');
  const [value, setValue] = useState(commercial.contract_value != null ? String(commercial.contract_value) : '');
  const [client, setClient] = useState({ id: commercial.client_id ?? '', name: commercial.client_name ?? '' });
  const [costCenter, setCostCenter] = useState({ id: commercial.cost_center_id ?? '', name: commercial.cost_center_name ?? '' });

  const { data: initialContacts = [] } = useQuery({
    queryKey: ['lookups', orgSlug, 'contacts', ''],
    queryFn: () => projectsApi.searchContacts(orgSlug, ''),
    staleTime: 60_000,
  });
  const { data: costCenters = [], isLoading: ccLoading } = useQuery({
    queryKey: ['lookups', orgSlug, 'cost-centers'],
    queryFn: () => projectsApi.costCenters(orgSlug),
    staleTime: 5 * 60_000,
  });

  const valueNum = value.trim() === '' ? null : Number(value);
  const invalid = billing === 'fixed' && valueNum != null && (Number.isNaN(valueNum) || valueNum < 0);

  function save() {
    update.mutate(
      {
        id: projectId,
        data: {
          metadata: {
            billing_type: billing || null,
            contract_value: billing === 'fixed' && valueNum != null ? valueNum : null,
            crm_contact_id: client.id || null,
            crm_contact_name: client.id ? client.name : null,
            cost_center_id: costCenter.id || null,
            cost_center_name: costCenter.id ? costCenter.name : null,
          },
        },
      },
      { onSuccess: onDone },
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Billing</span>
          <select className={inputClass} value={billing} onChange={(e) => setBilling(e.target.value as BillingType | '')}>
            <option value="">Not set</option>
            {(Object.keys(billingLabel) as BillingType[]).map((b) => (
              <option key={b} value={b}>
                {billingLabel[b]}
              </option>
            ))}
          </select>
        </label>
        {billing === 'fixed' && (
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Contract value</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Agreed price"
            />
          </label>
        )}
        <div className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Client (from the CRM)</span>
          <SearchableCombobox
            options={initialContacts.map(toOption)}
            value={client.id}
            valueLabel={client.name}
            onChange={(id, opt) => setClient({ id, name: opt?.label ?? '' })}
            onRemoteSearch={async (q) => (await projectsApi.searchContacts(orgSlug, q)).map(toOption)}
            placeholder="Choose a client"
            searchPlaceholder="Search name, email or phone"
            emptyText="No matching contacts"
            clearable
          />
        </div>
        <div className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Cost centre</span>
          <SearchableCombobox
            options={costCenters.map(toOption)}
            value={costCenter.id}
            valueLabel={costCenter.name}
            onChange={(id, opt) => setCostCenter({ id, name: opt?.label ?? '' })}
            loading={ccLoading}
            placeholder="Choose a cost centre"
            searchPlaceholder="Search cost centres"
            emptyText="No cost centres"
            clearable
          />
        </div>
      </div>
      {invalid && <p className="text-sm text-red-600">Contract value must be zero or more.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button onClick={save} disabled={update.isPending || invalid}>
          {update.isPending ? 'Saving...' : 'Save terms'}
        </Button>
      </div>
    </div>
  );
}
