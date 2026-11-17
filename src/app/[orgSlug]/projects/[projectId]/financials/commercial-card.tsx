'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShareSwitch } from '@/components/portal/share-switch';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { projectsApi, type LookupOption } from '@/lib/api/projects';
import type { BillingType, Commercial } from '@/lib/api/financials';
import { moneyOf, validPrice } from '@/lib/billing/logic';
import { formatCurrency } from '@bengo-hub/shared-ui-lib/format';

const billingLabel: Record<BillingType, string> = {
  fixed: 'Fixed price',
  time_and_materials: 'Time and materials',
  retainer: 'Monthly retainer',
  non_billable: 'Internal (not billed)',
};

const toOption = (o: LookupOption): ComboboxOption => ({ value: o.id, label: o.name, hint: o.detail });

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

/** The rate and retainer terms, kept in project metadata (the commercial summary does not carry them). */
interface RateTerms {
  hourlyRate: string;
  retainerAmount: string;
  retainerHours: string;
  retainerRollover: boolean;
  taxCode: string;
}

// VAT on the project's invoices: treasury's tax catalogue codes (projects-api TaxRates). Unset
// sends no VAT, so a VAT registered firm picks one.
const TAX_CODES: { value: string; label: string }[] = [
  { value: 'VAT-16', label: 'VAT 16%' },
  { value: 'VAT-8', label: 'VAT 8%' },
  { value: 'VAT-0', label: 'Zero rated (0%)' },
  { value: 'VAT-EXEMPT', label: 'VAT exempt' },
];

function rateTermsOf(meta: Record<string, unknown> | undefined): RateTerms {
  const m = meta ?? {};
  const str = (v: unknown) => (v == null ? '' : String(v));
  return {
    hourlyRate: str(m.hourly_rate),
    retainerAmount: str(m.retainer_amount),
    retainerHours: str(m.retainer_hours),
    retainerRollover: m.retainer_rollover === true,
    taxCode: str(m.tax_code),
  };
}

function Figure({ label, children, hint, tone }: { label: string; children: React.ReactNode; hint?: React.ReactNode; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${tone ?? ''}`}>{children}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * The project's contract: how it is billed (fixed price, time and materials, a monthly retainer or
 * not at all), the agreed value or rate, the client (a CRM contact) and the cost centre its spend
 * belongs to, with the cost and margin those terms imply.
 */
export function CommercialCard({
  orgSlug,
  projectId,
  commercial,
  currency,
  unbilledHours,
}: {
  orgSlug: string;
  projectId: string;
  commercial: Commercial;
  currency: string;
  /** Approved billable hours not yet invoiced, from ERP. */
  unbilledHours?: number;
}) {
  const [editing, setEditing] = useState(false);
  const { can } = useServicePermissions();
  const { data: project } = useProject(orgSlug, projectId);
  const rates = rateTermsOf(project?.metadata);
  // The terms are saved with PUT /projects/{id}, which needs projects.projects.change.
  const canEdit = can(PERMS.projectsChange);
  const c = commercial;
  const margin = c.projected_margin;
  const billed = !!c.billing_type && c.billing_type !== 'non_billable';

  return (
    <Card id="contract" className="scroll-mt-20">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contract</CardTitle>
        {!editing && canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" /> Edit terms
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <CommercialForm
            key={project?.updated_at ?? 'terms'}
            orgSlug={orgSlug}
            projectId={projectId}
            commercial={c}
            rates={rates}
            onDone={() => setEditing(false)}
          />
        ) : !c.billing_type ? (
          <p className="text-sm text-muted-foreground">
            No contract terms yet. Set how the project is billed and its agreed value to see the margin it is heading for.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3 lg:grid-cols-6" data-testid="contract-summary">
            <Figure label="Billing">{billingLabel[c.billing_type] ?? c.billing_type}</Figure>
            <Figure label="Client">{c.client_name || '-'}</Figure>
            <Figure label="Cost centre">{c.cost_center_name || '-'}</Figure>
            {c.billing_type === 'fixed' && (
              <Figure label="Contract value">{c.contract_value != null ? formatCurrency(c.contract_value, currency) : 'Not set'}</Figure>
            )}
            {c.billing_type === 'time_and_materials' && (
              <Figure label="Hourly rate">{moneyOf(rates.hourlyRate) > 0 ? formatCurrency(moneyOf(rates.hourlyRate), currency) : 'Not set'}</Figure>
            )}
            {c.billing_type === 'retainer' && (
              <Figure
                label="Monthly retainer"
                hint={
                  rates.retainerHours !== ''
                    ? `${rates.retainerHours} h included, unused hours ${rates.retainerRollover ? 'roll over' : 'lapse'}`
                    : undefined
                }
              >
                {moneyOf(rates.retainerAmount) > 0 ? formatCurrency(moneyOf(rates.retainerAmount), currency) : 'Not set'}
              </Figure>
            )}
            {billed && (
              <Figure label="Invoiced" hint={c.unbilled != null ? `${formatCurrency(c.unbilled, currency)} still to bill` : undefined}>
                {formatCurrency(c.invoiced, currency)}
              </Figure>
            )}
            {billed && unbilledHours != null && unbilledHours > 0 && (
              <Figure label="Hours not yet billed" hint="Approved billable hours">
                {`${unbilledHours.toFixed(1)} h`}
              </Figure>
            )}
            {c.labour_cost != null && <Figure label="Labour cost" hint="From approved timesheets">{formatCurrency(c.labour_cost, currency)}</Figure>}
            {c.cost_to_date != null && <Figure label="Cost to date" hint="Booked cost plus labour">{formatCurrency(c.cost_to_date, currency)}</Figure>}
            {billed && c.margin_to_date != null && (
              <Figure label="Margin to date" hint="Invoiced less cost to date" tone={c.margin_to_date < 0 ? 'text-destructive' : 'text-success'}>
                {formatCurrency(c.margin_to_date, currency)}
                {c.margin_basis !== 'at_completion' && c.projected_margin_pct != null && (
                  <span className="ml-1 text-xs">({c.projected_margin_pct.toFixed(1)}%)</span>
                )}
              </Figure>
            )}
            {margin != null && c.margin_basis === 'at_completion' && (
              <Figure
                label="Margin at completion"
                hint="Contract value less forecast cost"
                tone={margin < 0 ? 'text-destructive' : 'text-success'}
              >
                {formatCurrency(margin, currency)}
                {c.projected_margin_pct != null && <span className="ml-1 text-xs">({c.projected_margin_pct.toFixed(1)}%)</span>}
              </Figure>
            )}
            {margin != null && c.margin_basis !== 'at_completion' && c.margin_to_date == null && (
              <Figure label="Margin to date" hint="Invoiced less cost" tone={margin < 0 ? 'text-destructive' : 'text-success'}>
                {formatCurrency(margin, currency)}
                {c.projected_margin_pct != null && <span className="ml-1 text-xs">({c.projected_margin_pct.toFixed(1)}%)</span>}
              </Figure>
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
  rates,
  onDone,
}: {
  orgSlug: string;
  projectId: string;
  commercial: Commercial;
  rates: RateTerms;
  onDone: () => void;
}) {
  const update = useUpdateProject(orgSlug);
  const [billing, setBilling] = useState<BillingType | ''>(commercial.billing_type ?? '');
  const [value, setValue] = useState(commercial.contract_value != null ? String(commercial.contract_value) : '');
  const [hourlyRate, setHourlyRate] = useState(rates.hourlyRate);
  const [retainerAmount, setRetainerAmount] = useState(rates.retainerAmount);
  const [retainerHours, setRetainerHours] = useState(rates.retainerHours);
  const [rollover, setRollover] = useState(rates.retainerRollover);
  const [taxCode, setTaxCode] = useState(rates.taxCode);
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
  const hoursNum = retainerHours.trim() === '' ? null : Number(retainerHours);
  const errors: string[] = [];
  if (billing === 'fixed' && valueNum != null && (Number.isNaN(valueNum) || valueNum < 0)) errors.push('Contract value must be zero or more.');
  if (billing === 'time_and_materials' && hourlyRate.trim() !== '' && !validPrice(hourlyRate))
    errors.push('The hourly rate must be above zero with at most two decimal places.');
  if (billing === 'retainer' && retainerAmount.trim() !== '' && !validPrice(retainerAmount))
    errors.push('The monthly fee must be above zero with at most two decimal places.');
  if (billing === 'retainer' && hoursNum != null && (Number.isNaN(hoursNum) || hoursNum < 0)) errors.push('Included hours must be zero or more.');

  function save() {
    const tm = billing === 'time_and_materials';
    const ret = billing === 'retainer';
    update.mutate(
      {
        id: projectId,
        data: {
          metadata: {
            billing_type: billing || null,
            contract_value: billing === 'fixed' && valueNum != null ? valueNum : null,
            hourly_rate: tm && hourlyRate.trim() !== '' ? hourlyRate.trim() : null,
            retainer_amount: ret && retainerAmount.trim() !== '' ? retainerAmount.trim() : null,
            retainer_hours: ret && hoursNum != null ? hoursNum : null,
            retainer_rollover: ret ? rollover : null,
            tax_code: billing && billing !== 'non_billable' && taxCode ? taxCode : null,
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Billing</span>
          <SearchableCombobox
            options={(Object.keys(billingLabel) as BillingType[]).map((b) => ({ value: b, label: billingLabel[b] }))}
            value={billing}
            onChange={(v) => setBilling(v as BillingType | '')}
            placeholder="Not set"
            searchPlaceholder="Find a billing type"
          />
        </div>
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
        {billing === 'time_and_materials' && (
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Hourly rate</span>
            <input
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="Price of a billable hour"
              aria-label="Hourly rate"
            />
          </label>
        )}
        {billing === 'retainer' && (
          <>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Monthly fee</span>
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={retainerAmount}
                onChange={(e) => setRetainerAmount(e.target.value)}
                placeholder="Billed every month"
                aria-label="Monthly fee"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Hours included each month</span>
              <input
                type="number"
                min={0}
                step="0.5"
                className={inputClass}
                value={retainerHours}
                onChange={(e) => setRetainerHours(e.target.value)}
                placeholder="For example 20"
                aria-label="Hours included each month"
              />
            </label>
            <div className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Unused hours</span>
              <ShareSwitch checked={rollover} onChange={setRollover} label="Roll unused hours over" onText="Roll over" offText="Lapse" />
            </div>
          </>
        )}
        {billing && billing !== 'non_billable' && (
          <div className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">VAT on invoices</span>
            <SearchableCombobox
              options={TAX_CODES}
              value={taxCode}
              onChange={(v) => setTaxCode(v)}
              placeholder="No VAT"
              searchPlaceholder="Find a VAT rate"
            />
          </div>
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
      {errors.map((e) => (
        <p key={e} className="text-sm text-destructive">
          {e}
        </p>
      ))}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button onClick={save} disabled={update.isPending || errors.length > 0}>
          {update.isPending ? 'Saving...' : 'Save terms'}
        </Button>
      </div>
    </div>
  );
}
