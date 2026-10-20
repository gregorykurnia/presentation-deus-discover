-- Neon / PGlite schema. Every statement is idempotent. Statements are separated by
-- "-- split" lines because the HTTP driver runs one statement per call.

create table if not exists editors (
  email text primary key,
  added_at timestamptz not null default now()
);
-- split
create table if not exists draft (
  id text primary key,
  deck jsonb not null,
  rev int not null default 1,
  locked boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now()
);
-- split
create table if not exists versions (
  deck_id text not null,
  n int not null,
  deck jsonb not null,
  published_by text not null,
  published_at timestamptz not null default now(),
  primary key (deck_id, n)
);
-- split
create or replace function versions_immutable() returns trigger as $$
begin
  raise exception 'Published versions cannot be changed or deleted';
end;
$$ language plpgsql;
-- split
drop trigger if exists versions_immutable on versions;
-- split
create trigger versions_immutable before update or delete on versions
  for each row execute function versions_immutable();
-- split
-- code_hash and expires_at are null while an email has no live code but still has send times,
-- so the rate limit covers every email, editor or not.
create table if not exists login_codes (
  email text primary key,
  code_hash text,
  expires_at timestamptz,
  attempts int not null default 0,
  sent_at timestamptz[] not null default '{}'
);
-- split
create table if not exists sessions (
  token_hash text primary key,
  email text not null,
  expires_at timestamptz not null
);
