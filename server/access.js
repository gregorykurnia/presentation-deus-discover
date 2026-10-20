// Who may do what. Every server module goes through here, never the browser.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Emails are lower-cased and trimmed at every entry point. */
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

/** 'owner' | 'editor' | 'none'. The owner is env.OWNER_EMAIL; editors are rows. */
export async function roleOf(ctx, email) {
  const who = normalizeEmail(email);
  if (!who) return 'none';
  if (who === normalizeEmail(ctx.env.OWNER_EMAIL)) return 'owner';
  const rows = await ctx.db.query('select 1 from editors where email = $1', [who]);
  return rows.length ? 'editor' : 'none';
}

/** Throws 401 when signed out and 403 when the role is not allowed. Returns the role. */
export async function requireRole(ctx, who, allowed = ['owner', 'editor']) {
  if (!normalizeEmail(who)) throw new HttpError(401, 'Sign in to continue.');
  const role = await roleOf(ctx, who);
  if (!allowed.includes(role)) throw new HttpError(403, "You don't have access to do that.");
  return role;
}
