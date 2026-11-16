// How people are named on the work screens. Pure, no imports, so node tests load it directly.

export interface PersonLike {
  userId: string;
  name?: string | null;
  email?: string | null;
  isMe?: boolean;
  /** Not on the project any more (an old assignee, uploader or comment author). */
  former?: boolean;
}

function shortId(id: string) {
  return id.slice(0, 8);
}

/**
 * The name to show: the person's name, else their email, else "You" for the viewer, else a short
 * id (someone who has not signed in to projects yet has no name in the API's copy).
 */
export function personLabel(p: PersonLike): string {
  const name = p.name?.trim();
  if (name) return name;
  const email = p.email?.trim();
  if (email) return email;
  if (p.isMe) return 'You';
  return `${p.former ? 'Former member' : 'Member'} ${shortId(p.userId)}`;
}

/** Two letters for an avatar. */
export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
