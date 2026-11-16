// Saved list filters, kept per project in this browser (localStorage, every access guarded).

export interface TaskFilters {
  status?: string;
  priority?: string;
  /** "me" or a user id. */
  assignee?: string;
}

export interface SavedFilter {
  name: string;
  filters: TaskFilters;
}

const PREFIX = 'projects-task-filters:';
const MAX_SAVED = 12;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function clean(f: unknown): TaskFilters {
  const o = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
  const pick = (k: string) => (typeof o[k] === 'string' && o[k] ? (o[k] as string) : undefined);
  return { status: pick('status'), priority: pick('priority'), assignee: pick('assignee') };
}

export interface FilterState {
  current: TaskFilters;
  saved: SavedFilter[];
}

export function parseFilterState(raw: string | null): FilterState {
  try {
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const saved = Array.isArray(v.saved)
      ? (v.saved as unknown[])
          .map((s) => {
            const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
            return typeof o.name === 'string' && o.name.trim() ? { name: o.name.trim(), filters: clean(o.filters) } : null;
          })
          .filter((s): s is SavedFilter => !!s)
      : [];
    return { current: clean(v.current), saved };
  } catch {
    return { current: {}, saved: [] };
  }
}

export function loadFilters(projectId: string): FilterState {
  try {
    return parseFilterState(storage()?.getItem(PREFIX + projectId) ?? null);
  } catch {
    return { current: {}, saved: [] };
  }
}

export function storeFilters(projectId: string, state: FilterState) {
  try {
    storage()?.setItem(PREFIX + projectId, JSON.stringify(state));
  } catch {
    /* storage blocked or full: filters simply do not persist */
  }
}

/** Saves the current filters under a name; the same name replaces the older entry. */
export function saveNamed(state: FilterState, name: string): FilterState {
  const n = name.trim().slice(0, 40);
  if (!n) return state;
  const saved = [{ name: n, filters: { ...state.current } }, ...state.saved.filter((s) => s.name !== n)].slice(0, MAX_SAVED);
  return { ...state, saved };
}

export function removeNamed(state: FilterState, name: string): FilterState {
  return { ...state, saved: state.saved.filter((s) => s.name !== name) };
}

export function activeCount(f: TaskFilters): number {
  return [f.status, f.priority, f.assignee].filter(Boolean).length;
}
