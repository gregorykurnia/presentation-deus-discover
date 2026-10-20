# Phase 3 design: accounts, lock, publish, share link (Neon + Vercel)

Replaces the Firebase design in `docs/superpowers/plans/2026-10-20-deus-deck.md` (Tasks 10–12).
The goals and Review Focus 4 and 5 stay the same; only the platform changes.

## Decisions (from the user, 2026-10-20)

| Topic | Decision |
|---|---|
| Owner | `gregory.kurnia@deushcs.com`: lock/unlock, manage editors, restore versions |
| Editors | `gregory.kurnia@gmail.com`, `thania.ferdinanto@deushcs.com`, `audrey.wijaya@deushcs.com` |
| Database | Neon Postgres |
| Sign-in | 6-digit code sent to the editor's email. deushcs.com mail is on Titan, not Google, so Google sign-in was dropped. |
| Sharing | Public read-only share link **and** the PDF |
| Address | Free default address. Hosting is Vercel, so this is `*.vercel.app`, not `*.web.app`. |

Assumptions the user accepted: Vercel hosts the site and the API, Vercel Blob holds uploads, and Resend sends the codes.

## Architecture

```
browser ──► Vercel static files  (present.html = viewer, edit.html = editor)
        └─► Vercel functions  api/*  ──► server/*  (all checks)  ──► Neon Postgres
                                                               └─► Vercel Blob (upload tokens)
                                                               └─► Resend (login codes)
```

- The browser never talks to the database. `DATABASE_URL` exists only on the server.
- `api/*.js` files are thin wrappers. All logic lives in `server/*.js` modules that take their dependencies
  (`db`, `mailer`, `blob`, `now`, `env`) as arguments, so tests can call them directly.
- `db` is a minimal `{ query(text, params) -> rows }` interface:
  - production: `@neondatabase/serverless`;
  - tests and the local server: `@electric-sql/pglite` (in-memory, or a file under `.data/` for local runs).
- Every check that could race is a single SQL statement, so no transactions are needed. This keeps the
  Neon HTTP driver usable.
- The same `server/` code is mounted on the Vite dev server for `npm run dev:server`, so the full
  signed-in setup runs locally with PGlite, with codes printed to the terminal and uploads written to `assets/uploads/`.

## Data (Neon tables)

```sql
editors     (email text primary key, added_at timestamptz)          -- owner is implicit, from env
draft       (id text primary key, deck jsonb, rev int, locked bool,
             updated_by text, updated_at timestamptz)
versions    (deck_id text, n int, deck jsonb, published_by text, published_at timestamptz,
             primary key (deck_id, n))                               -- trigger rejects UPDATE/DELETE
login_codes (email text primary key, code_hash text, expires_at timestamptz, attempts int,
             sent_at timestamptz[])                                  -- recent send times, for the rate limit
sessions    (token_hash text primary key, email text, expires_at timestamptz)
```

- `OWNER_EMAIL` comes from an environment variable. Nobody can become owner through the app.
- Emails are lower-cased and trimmed everywhere.
- The latest published version is `max(n)`. No separate meta row is kept.
- The first time the draft is read and no row exists, it is seeded from the bundled `content/deck.json`.
- `server/schema.sql` creates everything, and `npm run db:migrate` applies it. Every statement is
  idempotent (`create … if not exists`).

## Sign-in (email code)

1. `POST /api/auth/request-code {email}`
   - If the email is an editor or the owner, the server makes a 6-digit code and stores its hash
     (HMAC-SHA256 with `AUTH_SECRET`), valid for 10 minutes with 5 attempts allowed. Then it mails the code.
   - At most 3 codes per email per 15 minutes; past that it answers 429 ("Too many codes. Try again in a few minutes.").
   - The response is the same 200 for every email, so nobody can probe the list:
     "If this email can edit the deck, a code is on its way."
2. `POST /api/auth/verify {email, code}`
   - A wrong code adds one attempt. After 5, the code is deleted ("Code expired. Request a new one.").
   - A correct code deletes the login code and creates a session: a random 32-byte token, stored hashed,
     lasting 30 days. The response sets the cookie `deus_session` (HttpOnly, Secure except on localhost,
     SameSite=Lax, Path=/).
3. `POST /api/auth/sign-out` deletes the session and clears the cookie.
4. `GET /api/me` returns `{ email, role }`, where role is `owner | editor | none`.
   - A session whose email was removed from the editor list counts as `none` on every request.
   - So removing someone takes effect immediately.

- **CSRF:** every state-changing request must be `application/json` and its `Origin`, when present, must
  match the site. Requests that fail either check get 403.
- **Mailer:** `server/mailer.js`.
  - **Resend:** used when `RESEND_API_KEY` is set, with a plain `fetch` (no SDK). The sender is `MAIL_FROM`,
    for example `DEUS Deck <deck@deushcs.com>`.
  - **Console:** used otherwise. It prints `Login code for x@y.com: 123456`. Production refuses to start
    without a key.
- The editor's sign-in screen has an email field, then a code field. It handles "Resend code" and
  "Use a different email". If a signed-in person loses edit access, they see "You're signed in as
  x@y.com, which doesn't have edit access. Ask the owner to add you." plus a Sign out button.

## API and checks (replaces the security rules)

| Endpoint | Who | Behaviour |
|---|---|---|
| `GET /api/draft` | editor, owner | `{deck, rev, locked, role}` |
| `PUT /api/draft {deck, expectedRev}` | editor, owner | `validateDeck` must pass (else 400). Runs `UPDATE draft SET deck, rev=rev+1 … WHERE rev=$expected AND NOT locked RETURNING rev`. When no row matches: 423 if locked, else 409 (`ConflictError`). |
| `POST /api/lock {locked}` | owner | Sets `locked`. While locked, nobody can save, including the owner. |
| `POST /api/publish` | editor, owner | Copies the **saved** draft into `versions` as `n = max+1` in one `INSERT … SELECT`. The client sends no deck. 423 while locked. Returns `{version}`. |
| `GET /api/versions` | editor, owner | List of `{n, publishedBy, publishedAt}` |
| `POST /api/restore {n}` | owner | Copies version n into the draft (`rev+1`). Refused while locked. |
| `GET /api/published` / `GET /api/published/:n` | public | `{version, deck}`. 404 if nothing is published yet. Cached briefly: `s-maxage=30` for latest, immutable for `:n`. |
| `GET/POST/DELETE /api/editors` | owner | List, add or remove editor emails. The owner can't be removed. |
| `POST /api/upload` | editor, owner | Vercel Blob client-upload token handshake (`handleUpload`). The token allows only `image/jpeg|png|webp` up to 10 MB, or `video/mp4` up to 200 MB, under `decks/deus-pitch/uploads/` with a random suffix. |

- 401 means not signed in and 403 means signed in without access.
- Errors are JSON `{error}`, which the existing `errorFrom()` in the store already reads.
- Version immutability is enforced twice: no endpoint can change a version, and a database trigger
  blocks any update or delete.

## Front end

- **`src/store/server.js`:** a new adapter with the existing store interface: `load`, `saveDraft`,
  `uploadImage`, `publish`, `setLocked`. It adds `me`, `requestCode`, `verify`, `signOut`, `versions`,
  `restore` and `editors.*`.
  - `uploadImage` uses `@vercel/blob/client` `upload()` in production.
  - Under `dev:server` it posts to the local upload route instead.
- **`edit.html`:** picks the adapter from a build flag.
  - `npm run edit` keeps today's file store, with no sign-in. The Phase 2 e2e suite is unchanged.
  - `dev:server` and production use the server store.
- **Toolbar:**
  - Lock and Publish are now enabled. Publish first flushes any pending autosave.
  - When locked, editing is greyed out with "Locked by the owner".
  - The owner also gets an Editors dialog and a Versions list with Restore.
  - Download/Upload JSON stay.
- **Viewer:**
  - `/` loads `/api/published`, and `/v/N` loads `/api/published/N` (both rewritten to `present.html` in `vercel.json`).
  - It contains no editor code.
  - If nothing is published yet, it shows "This deck hasn't been published yet."
  - `present.html?source=draft` (Preview) still works for signed-in editors.
- **Images:** an absolute `src` (a Blob URL) is used as is. A relative `src` resolves against `assetBase`.

## PDF and offline from the published version

- `npm run pdf -- --source published [--version N]` and `npm run export:offline -- --source published [--version N]`
  fetch `${DECK_SITE}/api/published[/N]` anonymously.
- The offline build downloads any Blob images into `dist/offline/assets/uploads/` and rewrites their
  `src`, so the USB bundle still runs with no internet.

## Hosting and environments

- **Vercel project:** a Vite static build, plus `api/` functions on the Node runtime.
- **`vercel.json`:** sets the rewrites and `"git": { "deploymentEnabled": { "staging": false, "lane-*": false } }`.
  So `main` is production and only moves on "release".
- **Environment variables:** `DATABASE_URL` (from the Neon Marketplace integration), `BLOB_READ_WRITE_TOKEN`
  (Blob store), `OWNER_EMAIL`, `AUTH_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `DECK_SITE`. All are listed in `.env.example`.
- **What the user sets up** (README gives exact clicks):
  - a Vercel project linked to the GitHub repo, with Neon and Blob added from the Marketplace;
  - a Resend account and its DNS records on deushcs.com. Until the domain is verified, Resend only
    delivers to the account owner's own address.
- **Project `CLAUDE.md`:** short. It points to the global staging/lanes/release rules, with checks adjusted for this stack.

## Testing

- **Unit (Vitest + PGlite):** one test per former rules case, run against the real `server/` functions.
  - signed out: the draft is unreadable; `published` is readable;
  - non-editor: no read or write;
  - editor saves with `rev+1`;
  - stale rev → 409;
  - locked → 423 for everyone;
  - only the owner can lock, manage editors or restore;
  - versions can't be updated or deleted (trigger);
  - removed editor → existing session denied.
- **Auth unit tests:** same reply for any email, expiry, the 5-attempt limit, the send rate limit,
  hashed storage, the CSRF/Origin check, and the session cookie flags.
- **Upload token tests:** type and size limits are passed to `handleUpload`, and non-editors are refused.
- **e2e (`dev:server`, PGlite in memory, console mailer that the test reads):**
  - sign-in, edit, publish → `/` shows v1;
  - a later draft edit is not visible at `/`;
  - owner Lock greys out a second editor's session, and that session's save is rejected;
  - two sessions saving → conflict message;
  - `/v/1` shows version 1;
  - the viewer bundle has no `contenteditable`.
- **Live smoke test (manual, after release):** run through these on the `*.vercel.app` URL:
  - owner signs in with a real code, edits, publishes;
  - a private window shows the share link;
  - `npm run pdf -- --source published`.

## Out of scope

- Google sign-in, custom domain, real-time co-editing (conflicts are rejected, not merged).
- Cleaning up orphaned uploads. Kept in the carry-forward list.
