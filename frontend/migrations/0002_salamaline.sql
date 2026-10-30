-- SalamaLine schema. Privacy by design: there is NO table for names, ages,
-- message text or raw phone numbers. The only per-girl data is a keyed hash
-- (for FUTA/withdraw) and AES-GCM ciphertext (only with consent); both are
-- set to NULL when a case closes, is withdrawn, or expires.

create table if not exists sl_responders (
  id          text primary key,
  name        text not null,
  phone       text not null,           -- staff number, not a girl's
  phone_hash  text not null unique,
  district    text not null,           -- district id, or '*' for a focal person
  role        text not null check (role in ('responder','focal')),
  active      boolean not null default true
);

create table if not exists sl_cases (
  id             text primary key,
  code           text not null unique,
  kind           text not null,
  anonymous      boolean not null,
  priority       text not null check (priority in ('urgent','normal')),
  district       text not null,
  channel        text not null,
  status         text not null check (status in ('open','accepted','closed','withdrawn')),
  created_at     bigint not null,
  last_alert_at  bigint not null,
  alert_count    integer not null default 1,
  escalated_at   bigint,
  accepted_at    bigint,
  closed_at      bigint,
  responder_id   text,
  phone_hash     text,
  phone_enc      text
);
create index if not exists sl_cases_status_idx on sl_cases (status);
create index if not exists sl_cases_phone_hash_idx on sl_cases (phone_hash) where phone_hash is not null;

create table if not exists sl_pending (
  key         text primary key,        -- phone hash
  kind        text not null,
  district    text not null,
  expires_at  bigint not null
);

create table if not exists sl_once (
  key         text primary key,
  expires_at  bigint not null
);

create table if not exists sl_counters (
  day       text not null,
  event     text not null,
  district  text not null,
  channel   text not null,
  count     integer not null default 0,
  primary key (day, event, district, channel)
);
