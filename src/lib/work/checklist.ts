// The task checklist lives in task metadata under "checklist" and changes only through item
// operations (PATCH /tasks/{id}/checklist), applied on the API under the task row lock. These pure
// helpers read it and apply an operation locally the same way the API does, for the optimistic
// view. No imports, so node tests load the file directly.

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** One change, sent as the PATCH body. */
export type ChecklistOp =
  | { op: 'add'; item_id: string; text: string; position?: number }
  | { op: 'toggle'; item_id: string; done: boolean }
  | { op: 'rename'; item_id: string; text: string }
  | { op: 'remove'; item_id: string }
  | { op: 'reorder'; item_id: string; position: number };

export const CHECKLIST_KEY = 'checklist';
/** The API's limits: text length and items per task. */
export const MAX_TEXT = 500;
export const MAX_ITEMS = 200;

/** Reads the checklist from task metadata, dropping anything malformed. */
export function readChecklist(metadata: Record<string, unknown> | undefined | null): ChecklistItem[] {
  const raw = metadata?.[CHECKLIST_KEY];
  if (!Array.isArray(raw)) return [];
  const out: ChecklistItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, text, done } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || seen.has(id) || typeof text !== 'string') continue;
    seen.add(id);
    out.push({ id, text, done: done === true });
  }
  return out;
}

/** An item id the API accepts (letters, digits, dashes, underscores; at most 64). */
export function newItemId(random: () => number = Math.random): string {
  return `c${Date.now().toString(36)}${Math.floor(random() * 1e8).toString(36)}`;
}

function cleanText(text: string): string {
  return text.trim().slice(0, MAX_TEXT);
}

/** The add operation for typed text, or null for blank text. */
export function addOp(text: string, id = newItemId()): ChecklistOp | null {
  const clean = cleanText(text);
  return clean ? { op: 'add', item_id: id, text: clean } : null;
}

/** The rename operation; renaming to blank removes the item, and an unchanged text sends nothing. */
export function renameOp(item: ChecklistItem, text: string): ChecklistOp | null {
  const clean = cleanText(text);
  if (!clean) return { op: 'remove', item_id: item.id };
  return clean === item.text ? null : { op: 'rename', item_id: item.id, text: clean };
}

/** A tick sends the state wanted, never "flip", so a replay cannot undo it. */
export function toggleOp(item: ChecklistItem): ChecklistOp {
  return { op: 'toggle', item_id: item.id, done: !item.done };
}

function clamp(pos: number | undefined, n: number): number {
  if (pos === undefined || pos > n) return n;
  return Math.max(0, pos);
}

/** Applies an operation as the API does: unknown items are left alone, an add of an existing id is a no-op. */
export function applyOp(items: ChecklistItem[], op: ChecklistOp): ChecklistItem[] {
  const at = items.findIndex((i) => i.id === op.item_id);
  switch (op.op) {
    case 'add': {
      if (at >= 0 || items.length >= MAX_ITEMS) return items;
      const next = [...items];
      next.splice(clamp(op.position, next.length), 0, { id: op.item_id, text: cleanText(op.text), done: false });
      return next;
    }
    case 'toggle':
      return at < 0 ? items : items.map((i, n) => (n === at ? { ...i, done: op.done } : i));
    case 'rename':
      return at < 0 ? items : items.map((i, n) => (n === at ? { ...i, text: cleanText(op.text) } : i));
    case 'remove':
      return at < 0 ? items : items.filter((_, n) => n !== at);
    case 'reorder': {
      if (at < 0) return items;
      const next = items.filter((_, n) => n !== at);
      next.splice(clamp(op.position, next.length), 0, items[at]);
      return next;
    }
  }
}

/** The task metadata with an operation applied to its checklist (for the optimistic view). */
export function metadataWithOp(metadata: Record<string, unknown> | undefined | null, op: ChecklistOp): Record<string, unknown> {
  return { ...(metadata ?? {}), [CHECKLIST_KEY]: applyOp(readChecklist(metadata), op) };
}

/** Done and total, for "2 of 5" and the bar. */
export function checklistProgress(items: ChecklistItem[]): { done: number; total: number; pct: number } {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}
