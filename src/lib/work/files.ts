// Project and task files. Pure, no imports, so node tests load it directly.

/** A byte count as B, KB or MB. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface FilePlace {
  /** "Project" or the task's title (a neutral label when the title is not cached). */
  label: string;
  /** The task link under /{org}, or null for a file on the project itself. */
  href: string | null;
}

/** Where a file hangs: the project itself, or one of its tasks (linking to the task drawer). */
export function filePlace(
  file: { task_id?: string | null },
  orgSlug: string,
  projectId: string,
  titleOf: (taskId: string) => string | undefined,
): FilePlace {
  if (!file.task_id) return { label: 'Project', href: null };
  return {
    label: titleOf(file.task_id) ?? 'A task',
    href: `/${orgSlug}/projects/${projectId}/tasks?task=${encodeURIComponent(file.task_id)}`,
  };
}
