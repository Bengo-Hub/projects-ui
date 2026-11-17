// Status rules and automations (sprint 16): the editors' model and the checks the API makes, so a
// mistake shows before the save. No React, no aliases and no runtime imports, so node-tests can
// load this file directly.

export interface Transition {
  from: string;
  to: string[];
}

export interface Requirement {
  to: string;
  from?: string;
  fields: string[];
}

export interface StatusRules {
  transitions: Transition[];
  requirements: Requirement[];
}

export type ActionType = 'assign' | 'notify' | 'set_field';

export interface AutomationAction {
  type: ActionType;
  user_ids?: string[];
  mode?: 'add' | 'replace';
  recipients?: string[];
  message?: string;
  field?: string;
  value?: unknown;
}

export interface AutomationRule {
  /** Empty for a new rule; the API gives it one on save. */
  id?: string;
  name: string;
  enabled: boolean;
  trigger: { to: string; from?: string };
  actions: AutomationAction[];
}

/** The API's limits. */
export const MAX_RULE_ENTRIES = 100;
export const MAX_AUTOMATIONS = 25;
export const MAX_ACTIONS = 5;
export const MAX_NOTIFY_PEOPLE = 20;
export const MAX_MESSAGE = 500;
export const MAX_NAME = 120;

/** Required field codes the API knows, with the words its messages use. */
export const FIELD_LABEL: Record<string, string> = {
  assignee: 'An assignee',
  estimated_hours: 'An estimate',
  actual_hours: 'Actual hours',
  start_date: 'A start date',
  due_date: 'A due date',
  description: 'A description',
  comment: 'A comment',
};
export const FIELD_CODES = Object.keys(FIELD_LABEL);

/** Priorities an automation may set: the task priorities (low, medium, high, critical). */
export const AUTOMATION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

/** Task metadata keys an automation may never set: the server's own and the repeat rule. */
export const RESERVED_META_KEYS = ['status_mutations', 'timers', 'checklist', 'checklist_mutations', 'client_visible', 'recurrence', 'repeat'];

const META_KEY = /^[a-z][a-z0-9_]{0,59}$/;

export function emptyRules(): StatusRules {
  return { transitions: [], requirements: [] };
}

/** The API answer with any missing list read as empty. */
export function normaliseRules(r: Partial<StatusRules> | null | undefined): StatusRules {
  return {
    transitions: (r?.transitions ?? []).map((t) => ({ from: t.from, to: [...(t.to ?? [])] })),
    requirements: (r?.requirements ?? []).map((q) => ({ to: q.to, ...(q.from ? { from: q.from } : {}), fields: [...(q.fields ?? [])] })),
  };
}

/** Whether a move is allowed: a status without a transition entry moves anywhere. */
export function moveAllowed(rules: StatusRules, from: string, to: string): boolean {
  if (from === to) return true;
  const entry = rules.transitions.find((t) => t.from === from);
  return !entry || entry.to.includes(to);
}

/** Whether a status has its own list of moves (otherwise it moves anywhere). */
export function restricted(rules: StatusRules, from: string): boolean {
  return rules.transitions.some((t) => t.from === from);
}

/**
 * Turns one cell of the moves matrix on or off. Turning a cell off in a row that moves anywhere
 * makes the row list every other status but that one; a row that lists every other status again
 * goes back to moving anywhere, so the stored rules stay as short as they can be.
 */
export function toggleMove(rules: StatusRules, keys: string[], from: string, to: string): StatusRules {
  if (from === to) return rules;
  const others = keys.filter((k) => k !== from);
  const current = rules.transitions.find((t) => t.from === from)?.to ?? others;
  const next = current.includes(to) ? current.filter((k) => k !== to) : [...current, to];
  const ordered = others.filter((k) => next.includes(k));
  const rest = rules.transitions.filter((t) => t.from !== from);
  const transitions = ordered.length === others.length ? rest : [...rest, { from, to: ordered }];
  return { ...rules, transitions: sortByKeys(transitions, keys) };
}

/** Lets a status move anywhere again. */
export function clearMoves(rules: StatusRules, from: string): StatusRules {
  return { ...rules, transitions: rules.transitions.filter((t) => t.from !== from) };
}

function sortByKeys(list: Transition[], keys: string[]): Transition[] {
  return [...list].sort((a, b) => keys.indexOf(a.from) - keys.indexOf(b.from));
}

/** The fields a move into to needs from any status (the editor's row). */
export function requiredFor(rules: StatusRules, to: string): string[] {
  return rules.requirements.find((q) => q.to === to && !q.from)?.fields ?? [];
}

/** Sets the fields a move into to needs from any status; none removes the requirement. */
export function setRequired(rules: StatusRules, to: string, fields: string[]): StatusRules {
  const rest = rules.requirements.filter((q) => !(q.to === to && !q.from));
  const clean = Array.from(new Set(fields.map((f) => f.trim()).filter(Boolean)));
  return { ...rules, requirements: clean.length ? [...rest, { to, fields: clean }] : rest };
}

/** Whether a required field code is one the API takes. */
export function validFieldCode(code: string): boolean {
  if (FIELD_CODES.includes(code)) return true;
  const key = code.startsWith('metadata.') ? code.slice('metadata.'.length) : '';
  return !!key && META_KEY.test(key);
}

/** A readable name for a field code. */
export function fieldLabel(code: string): string {
  return FIELD_LABEL[code] ?? `Field "${code.replace(/^metadata\./, '').replace(/_/g, ' ')}"`;
}

/** The first problem with the rules for these statuses, or null when the API would take them. */
export function rulesError(rules: StatusRules, keys: string[], labelOf: (k: string) => string = (k) => k): string | null {
  if (rules.transitions.length > MAX_RULE_ENTRIES || rules.requirements.length > MAX_RULE_ENTRIES) {
    return `Keep to ${MAX_RULE_ENTRIES} move lists and ${MAX_RULE_ENTRIES} requirements.`;
  }
  const seen = new Set<string>();
  for (const t of rules.transitions) {
    if (!keys.includes(t.from)) return `"${labelOf(t.from)}" is no longer a column on the board. Remove its moves.`;
    if (seen.has(t.from)) return `The moves from "${labelOf(t.from)}" are listed twice.`;
    seen.add(t.from);
    const bad = t.to.find((k) => !keys.includes(k));
    if (bad) return `"${labelOf(bad)}" is no longer a column on the board. Remove it from the moves.`;
  }
  for (const q of rules.requirements) {
    if (!keys.includes(q.to)) return `"${labelOf(q.to)}" is no longer a column on the board. Remove its required fields.`;
    if (q.from && !keys.includes(q.from)) return `"${labelOf(q.from)}" is no longer a column on the board.`;
    if (q.fields.length === 0) return `Moving to "${labelOf(q.to)}" lists no required fields.`;
    const bad = q.fields.find((f) => !validFieldCode(f));
    if (bad) return `"${bad}" is not a field a rule can require. Custom fields are lower case letters, digits and underscores.`;
  }
  return null;
}

/** A new, empty automation for the editor. */
export function newAutomation(to: string): AutomationRule {
  return { name: '', enabled: true, trigger: { to }, actions: [{ type: 'notify', recipients: ['assignees'], user_ids: [] }] };
}

/** A blank action of a type. */
export function blankAction(type: ActionType): AutomationAction {
  if (type === 'assign') return { type, user_ids: [], mode: 'add' };
  if (type === 'notify') return { type, user_ids: [], recipients: ['assignees'] };
  return { type, field: 'priority', value: 'high' };
}

function actionError(a: AutomationAction): string | null {
  if (a.type === 'assign') {
    if (!a.user_ids?.length) return 'assign needs at least one person';
    if (a.mode && a.mode !== 'add' && a.mode !== 'replace') return 'assign either adds people or replaces the assignees';
    return null;
  }
  if (a.type === 'notify') {
    const people = a.user_ids?.length ?? 0;
    if (people > MAX_NOTIFY_PEOPLE) return `notify reaches at most ${MAX_NOTIFY_PEOPLE} people`;
    if (people === 0 && !(a.recipients ?? []).includes('assignees')) return 'notify needs people or the assignees';
    if ((a.message ?? '').length > MAX_MESSAGE) return `the message is at most ${MAX_MESSAGE} characters`;
    return null;
  }
  if (a.type === 'set_field') {
    if (a.field === 'priority') {
      return (AUTOMATION_PRIORITIES as readonly string[]).includes(String(a.value)) ? null : 'the priority must be low, medium, high or critical';
    }
    const key = a.field?.startsWith('metadata.') ? a.field.slice('metadata.'.length) : '';
    if (!key || !META_KEY.test(key)) return 'set a priority or a custom field (lower case letters, digits and underscores)';
    if (RESERVED_META_KEYS.includes(key)) return `"${key}" cannot be set by an automation`;
    if (JSON.stringify(a.value ?? null).length > 2000) return 'the value is too large';
    return null;
  }
  return 'pick assign, notify or set a field';
}

/** The first problem with the automations, or null when the API would take them. */
export function automationsError(list: AutomationRule[], keys: string[]): string | null {
  if (list.length > MAX_AUTOMATIONS) return `A project has at most ${MAX_AUTOMATIONS} automations.`;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const name = a.name.trim();
    const which = name ? `"${name}"` : `Automation ${i + 1}`;
    if (!name || name.length > MAX_NAME) return `${which} needs a name of at most ${MAX_NAME} characters.`;
    if (!keys.includes(a.trigger.to)) return `${which}: pick the status that starts it.`;
    if (a.trigger.from && !keys.includes(a.trigger.from)) return `${which}: the "from" status is not on the board.`;
    if (a.actions.length < 1 || a.actions.length > MAX_ACTIONS) return `${which} needs 1 to ${MAX_ACTIONS} actions.`;
    for (const act of a.actions) {
      const e = actionError(act);
      if (e) return `${which}: ${e}.`;
    }
  }
  return null;
}

/** The body for the save: new rules go without an id, empty optional parts are left out. */
export function automationsBody(list: AutomationRule[]): AutomationRule[] {
  return list.map((a) => ({
    ...(a.id ? { id: a.id } : {}),
    name: a.name.trim(),
    enabled: a.enabled,
    trigger: a.trigger.from ? { to: a.trigger.to, from: a.trigger.from } : { to: a.trigger.to },
    actions: a.actions.map((x) => {
      if (x.type === 'assign') return { type: x.type, user_ids: x.user_ids ?? [], mode: x.mode ?? 'add' };
      if (x.type === 'notify') {
        const out: AutomationAction = { type: x.type };
        if (x.user_ids?.length) out.user_ids = x.user_ids;
        if (x.recipients?.length) out.recipients = x.recipients;
        if (x.message?.trim()) out.message = x.message.trim();
        return out;
      }
      return { type: x.type, field: x.field, value: x.value };
    }),
  }));
}

/** One line on what an automation does, for its card. */
export function automationSummary(a: AutomationRule, labelOf: (k: string) => string, nameOf: (id: string) => string): string {
  const when = a.trigger.from ? `When a task moves from ${labelOf(a.trigger.from)} to ${labelOf(a.trigger.to)}` : `When a task moves to ${labelOf(a.trigger.to)}`;
  const names = (ids?: string[]) => (ids ?? []).map(nameOf).join(', ');
  const parts = a.actions.map((x) => {
    if (x.type === 'assign') return `${x.mode === 'replace' ? 'assign only' : 'also assign'} ${names(x.user_ids) || 'nobody'}`;
    if (x.type === 'notify') {
      const who = [...((x.recipients ?? []).includes('assignees') ? ['the assignees'] : []), ...(x.user_ids ?? []).map(nameOf)];
      return `notify ${who.join(', ') || 'nobody'}`;
    }
    if (x.field === 'priority') return `set the priority to ${String(x.value)}`;
    return `set ${String(x.field).replace(/^metadata\./, '')} to ${JSON.stringify(x.value)}`;
  });
  return `${when}: ${parts.join(', ')}.`;
}

export interface MoveCheckLike {
  status: string;
  allowed: boolean;
  reason?: string;
  missing_fields?: string[];
  message?: string;
}

/** Why a move is blocked, in words; null when it is allowed or unknown. */
export function blockedReason(checks: MoveCheckLike[] | undefined, to: string): string | null {
  const c = checks?.find((x) => x.status === to);
  if (!c || c.allowed) return null;
  if (c.message) return c.message;
  if (c.reason === 'transition_not_allowed') return 'The project rules do not allow this move.';
  if (c.missing_fields?.length) return `Needs ${c.missing_fields.map((f) => fieldLabel(f).toLowerCase()).join(', ')} first.`;
  return 'The project rules block this move.';
}
