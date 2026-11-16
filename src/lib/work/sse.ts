// Pure helpers for the project stream (no imports, so node tests load this file directly).

export interface SSEMessage {
  event: string;
  data: string;
}

/**
 * Splits buffered stream text into complete messages. rest is the unfinished tail to keep for the
 * next chunk. Comment lines (the heartbeat) and messages without data are skipped.
 */
export function parseSSE(buffer: string): { messages: SSEMessage[]; rest: string } {
  const text = buffer.replace(/\r\n?/g, '\n');
  const messages: SSEMessage[] = [];
  let start = 0;
  let sep = text.indexOf('\n\n', start);
  while (sep >= 0) {
    const block = text.slice(start, sep);
    start = sep + 2;
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (data.length) messages.push({ event, data: data.join('\n') });
    sep = text.indexOf('\n\n', start);
  }
  return { messages, rest: text.slice(start) };
}

/** The data of a work event: ids only, the UI refetches. */
export interface WorkEvent {
  type: string;
  project_id: string;
  task_id?: string;
  id?: string;
  status?: string;
  actor_id?: string;
}

/** Which cached reads an event makes stale. */
export interface StaleScopes {
  board: boolean;
  task?: string;
  comments?: string;
  attachments: boolean;
  gantt: boolean;
  myWork: boolean;
}

export function staleScopesFor(e: WorkEvent): StaleScopes {
  switch (e.type) {
    case 'comment.created':
      return { board: false, task: e.task_id, comments: e.task_id, attachments: false, gantt: false, myWork: false };
    case 'attachment.added':
      return { board: false, task: e.task_id, attachments: true, gantt: false, myWork: false };
    case 'task.created':
    case 'task.updated':
    case 'task.deleted':
    case 'task.moved':
      return { board: true, task: e.task_id, attachments: false, gantt: true, myWork: true };
    default:
      return { board: false, attachments: false, gantt: false, myWork: false };
  }
}

/** Reconnect delay: 1 s doubling to 30 s, with up to 20% jitter. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.8 + random() * 0.2));
}
