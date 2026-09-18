-- Pages contre minutes — schéma Supabase
-- À coller tel quel dans Supabase > SQL Editor > Run. Ré-exécutable sans perte de données.

create extension if not exists pg_trgm with schema extensions;

-- ───────────────────────────── Tables ─────────────────────────────

create table if not exists app_config (
  id              int primary key default 1 check (id = 1),
  owner           uuid,                                   -- seul compte autorisé dans la PWA
  secret          text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  apps            text[] not null default array['TikTok','Instagram','YouTube'],
  session_cap_min int  not null default 30,
  daily_cap_min   int  not null default 120,
  summary_base    int  not null default 150,              -- caractères mini d'un résumé…
  summary_per_page int not null default 20,               -- …+ par page lue
  summary_max_req int  not null default 800,              -- plafond de l'exigence
  sec_per_page    int  not null default 0,                -- délai mini par page entre deux déclarations ; 0 = désactivé (la dictée va plus vite que ce délai)
  max_pages_per_log int not null default 100,
  overtime_factor int  not null default 2,
  tz              text not null default 'Europe/Paris',
  app_urls        jsonb not null default '{"TikTok":"snssdk1233://","Instagram":"instagram://","YouTube":"youtube://","X":"twitter://","Snapchat":"snapchat://","Reddit":"reddit://"}'
);
alter table app_config add column if not exists app_urls jsonb not null default '{"TikTok":"snssdk1233://","Instagram":"instagram://","YouTube":"youtube://","X":"twitter://","Snapchat":"snapchat://","Reddit":"reddit://"}';
insert into app_config (id) values (1) on conflict do nothing;

create table if not exists books (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author          text,
  cover_url       text,
  total_pages     int check (total_pages is null or total_pages > 0),
  openlibrary_key text,
  status          text not null default 'en_cours' check (status in ('en_cours','fini','abandonne')),
  current_page    int  not null default 0 check (current_page >= 0),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create table if not exists readings (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books(id) on delete restrict,
  page_start  int  not null,
  page_end    int  not null,
  pages       int  generated always as (page_end - page_start) stored,
  summary     text not null,
  created_at  timestamptz not null default now(),
  check (page_end > page_start)
);
create index if not exists readings_book_idx on readings (book_id, page_start);
create index if not exists readings_created_idx on readings (created_at);

create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  app             text not null,
  minutes_granted int  not null check (minutes_granted > 0),
  started_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  last_open_at    timestamptz not null default now(),
  last_close_at   timestamptz,
  overtime_min    int not null default 0
);
create index if not exists sessions_app_idx on sessions (app, started_at desc);

-- Solde de minutes = somme des delta. Négatif = dette.
create table if not exists ledger (
  id         bigint generated always as identity primary key,
  delta      int  not null,
  reason     text not null check (reason in ('lecture','session','dette_depassement','dette_audit')),
  ref_id     uuid,
  created_at timestamptz not null default now()
);

-- Contrôle hebdomadaire : temps d'écran réel (Réglages iOS) contre sessions enregistrées.
create table if not exists audits (
  week_start     date not null,
  app            text not null,
  real_minutes   int  not null check (real_minutes >= 0),
  logged_minutes int  not null,
  undeclared     int  not null,
  created_at     timestamptz not null default now(),
  primary key (week_start, app)
);

-- ───────────────────────────── Accès ─────────────────────────────
-- La PWA (compte propriétaire) lit tout, mais n'écrit que ce qui ne permet pas de tricher :
-- le solde, les sessions et les lectures ne passent que par les fonctions ci-dessous.

alter table app_config enable row level security;
alter table books      enable row level security;
alter table readings   enable row level security;
alter table sessions   enable row level security;
alter table ledger     enable row level security;
alter table audits     enable row level security;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select auth.uid() is not null and auth.uid() = (select owner from app_config where id = 1) $$;

do $$
declare t text;
begin
  foreach t in array array['app_config','books','readings','sessions','ledger','audits'] loop
    execute format('drop policy if exists owner_read on %I', t);
    execute format('create policy owner_read on %I for select to authenticated using (is_owner())', t);
  end loop;
end $$;

drop policy if exists owner_insert on books;
create policy owner_insert on books for insert to authenticated with check (is_owner());
drop policy if exists owner_update on books;
create policy owner_update on books for update to authenticated using (is_owner()) with check (is_owner());
drop policy if exists owner_delete on books;
create policy owner_delete on books for delete to authenticated using (is_owner());  -- échoue s'il y a des lectures (FK restrict)

drop policy if exists owner_update on app_config;
create policy owner_update on app_config for update to authenticated using (is_owner()) with check (is_owner());

revoke all on app_config, books, readings, sessions, ledger, audits from anon, authenticated;
grant select on app_config, books, readings, sessions, ledger, audits to authenticated;
grant insert, delete on books to authenticated;
-- current_page n'est pas modifiable à la main : sinon on pourrait « relire » les mêmes pages.
grant update (title, author, cover_url, total_pages, status, finished_at) on books to authenticated;
grant update (apps, session_cap_min, daily_cap_min) on app_config to authenticated;

-- ───────────────────────────── Outils internes ─────────────────────────────

create or replace function _check_secret(p_secret text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select secret from app_config where id = 1) then
    raise exception 'secret invalide' using errcode = '28000';
  end if;
end $$;

create or replace function _balance() returns int
language sql stable security definer set search_path = public as
$$ select coalesce(sum(delta), 0)::int from ledger $$;

create or replace function _today_start() returns timestamptz
language sql stable security definer set search_path = public as
$$ select date_trunc('day', now() at time zone c.tz) at time zone c.tz from app_config c where id = 1 $$;

create or replace function _book_label(b books) returns text
language sql immutable as
$$ select b.title || ' — p. ' || b.current_page $$;

revoke all on function _check_secret(text), _balance(), _today_start() from public, anon, authenticated;

-- ───────────────────────────── API des raccourcis ─────────────────────────────

-- Appelée à chaque ouverture d'une appli bloquée.
create or replace function gate_status(p_secret text, p_app text) returns json
language plpgsql security definer set search_path = public as $$
declare s sessions; bal int; labels json;
begin
  perform _check_secret(p_secret);
  select * into s from sessions where app = p_app and expires_at > now()
    order by expires_at desc limit 1;
  if found then
    update sessions set last_open_at = now() where id = s.id;
  end if;
  bal := _balance();
  select coalesce(json_agg(_book_label(b) order by b.started_at desc), '[]'::json) into labels
    from books b where b.status = 'en_cours';
  return json_build_object(
    'state',         case when s.id is not null then 'open' else 'locked' end,
    'prompt',        p_app || ' est bloqué. ' || case when bal < 0 then format('Dette : %s min — lis %s pages pour repartir de zéro.', -bal, -bal)
                       when bal = 0 then 'Solde : 0 min. 1 page lue et résumée = 1 minute.'
                       else format('Solde : %s min.', bal) end,
    'allowed',       s.id is not null,
    'remaining_sec', case when s.id is null then 0 else ceil(extract(epoch from s.expires_at - now()))::int end,
    'balance_min',   greatest(bal, 0),
    'debt_min',      greatest(-bal, 0),
    'max_minutes',   greatest(least(bal, (select session_cap_min from app_config)), 0),
    'books',         labels
  );
end $$;

-- « J'ai lu » : p_book est le libellé choisi dans la liste renvoyée par gate_status.
create or replace function log_reading(p_secret text, p_book text, p_page_end int, p_summary text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c app_config; b books; n int; need int; last_at timestamptz; wait_min int; rid uuid; txt text;
begin
  perform _check_secret(p_secret);
  select * into c from app_config where id = 1;
  select * into b from books where status = 'en_cours' and _book_label(books) = p_book limit 1;
  if not found then
    return json_build_object('ok', false, 'status', 'refus', 'error', 'Livre introuvable parmi les livres en cours.');
  end if;

  if p_page_end is null or p_page_end <= b.current_page then
    return json_build_object('ok', false, 'status', 'refus', 'error', format('Tu en étais déjà page %s : indique une page plus loin.', b.current_page));
  end if;
  if b.total_pages is not null and p_page_end > b.total_pages then
    return json_build_object('ok', false, 'status', 'refus', 'error', format('Ce livre n''a que %s pages.', b.total_pages));
  end if;
  n := p_page_end - b.current_page;
  if n > c.max_pages_per_log then
    return json_build_object('ok', false, 'status', 'refus', 'error', format('Maximum %s pages par résumé : résume en plusieurs fois.', c.max_pages_per_log));
  end if;

  -- Vitesse plausible : le temps écoulé depuis la dernière lecture déclarée doit suffire.
  select greatest(max(r.created_at), b.started_at) into last_at from readings r;
  last_at := coalesce(last_at, b.started_at);
  if extract(epoch from now() - last_at) < n * c.sec_per_page then
    wait_min := ceil((n * c.sec_per_page - extract(epoch from now() - last_at)) / 60.0);
    return json_build_object('ok', false, 'status', 'refus', 'error',
      format('%s pages depuis ta dernière déclaration, c''est trop rapide. Réessaie dans %s min (ou continue à lire).', n, wait_min));
  end if;

  txt := btrim(regexp_replace(coalesce(p_summary, ''), '\s+', ' ', 'g'));
  need := least(c.summary_base + c.summary_per_page * n, c.summary_max_req);
  if char_length(txt) < need then
    return json_build_object('ok', false, 'status', 'refus', 'error',
      format('Résumé trop court : %s caractères, il en faut %s pour %s pages.', char_length(txt), need, n));
  end if;
  if exists (select 1 from readings r where similarity(lower(r.summary), lower(txt)) > 0.75) then
    return json_build_object('ok', false, 'status', 'refus', 'error', 'Ce résumé ressemble trop à un ancien. Écris ce que tu viens de lire.');
  end if;

  insert into readings (book_id, page_start, page_end, summary)
    values (b.id, b.current_page, p_page_end, btrim(p_summary)) returning id into rid;
  update books set current_page = p_page_end,
                   status = case when total_pages is not null and p_page_end >= total_pages then 'fini' else status end,
                   finished_at = case when total_pages is not null and p_page_end >= total_pages then now() else finished_at end
    where id = b.id;
  insert into ledger (delta, reason, ref_id) values (n, 'lecture', rid);

  return json_build_object('ok', true, 'status', 'ok',
    'message', format('+%s min pour %s pages. ', n, n) || case when _balance() < 0 then format('Dette restante : %s min.', -_balance()) else format('Solde : %s min.', _balance()) end,
    'pages', n, 'balance_min', greatest(_balance(), 0), 'debt_min', greatest(-_balance(), 0),
    'max_minutes', greatest(least(_balance(), c.session_cap_min), 0));
end $$;

create or replace function start_session(p_secret text, p_app text, p_minutes int) returns json
language plpgsql security definer set search_path = public as $$
declare c app_config; s sessions; bal int; used int;
begin
  perform _check_secret(p_secret);
  select * into c from app_config where id = 1;

  select * into s from sessions where app = p_app and expires_at > now() order by expires_at desc limit 1;
  if found then
    return json_build_object('ok', true, 'status', 'ok', 'open_url', coalesce(c.app_urls->>p_app, ''),
      'minutes', ceil(extract(epoch from s.expires_at - now()) / 60.0)::int, 'expires_at', s.expires_at);
  end if;

  if p_minutes is null or p_minutes < 1 then
    return json_build_object('ok', false, 'status', 'refus', 'error', 'Nombre de minutes invalide.');
  end if;
  if p_minutes > c.session_cap_min then
    return json_build_object('ok', false, 'status', 'refus', 'error', format('Maximum %s min par session.', c.session_cap_min));
  end if;
  bal := _balance();
  if bal < p_minutes then
    return json_build_object('ok', false, 'status', 'refus', 'error',
      case when bal < 0 then format('Tu as %s min de dette : lis d''abord %s pages.', -bal, -bal + p_minutes)
           else format('Solde insuffisant : %s min. Il te manque %s pages.', bal, p_minutes - bal) end);
  end if;
  select coalesce(sum(minutes_granted), 0) into used from sessions where started_at >= _today_start();
  if used + p_minutes > c.daily_cap_min then
    return json_build_object('ok', false, 'status', 'refus', 'error',
      format('Plafond du jour atteint : %s/%s min déjà accordées.', used, c.daily_cap_min));
  end if;

  insert into sessions (app, minutes_granted, expires_at)
    values (p_app, p_minutes, now() + make_interval(mins => p_minutes)) returning * into s;
  insert into ledger (delta, reason, ref_id) values (-p_minutes, 'session', s.id);
  return json_build_object('ok', true, 'status', 'ok', 'open_url', coalesce(c.app_urls->>p_app, ''),
    'minutes', p_minutes, 'expires_at', s.expires_at);
end $$;

-- Appelée à chaque fermeture d'une appli bloquée. Rester après l'alarme coûte overtime_factor × le dépassement.
create or replace function close_session(p_secret text, p_app text) returns json
language plpgsql security definer set search_path = public as $$
declare c app_config; s sessions; over int := 0;
begin
  perform _check_secret(p_secret);
  p_app := btrim(regexp_replace(p_app, '^fermeture\s*', ''));   -- le raccourci envoie « fermeture TikTok »
  select * into c from app_config where id = 1;
  select * into s from sessions where app = p_app order by started_at desc limit 1;
  if not found then return json_build_object('ok', true, 'overtime_min', 0); end if;

  -- L'appli était ouverte au moment de l'expiration et n'a pas été refermée depuis.
  if now() > s.expires_at + interval '60 seconds'
     and s.last_open_at < s.expires_at
     and (s.last_close_at is null or s.last_close_at < s.last_open_at)
     and s.overtime_min = 0 then
    over := ceil(extract(epoch from now() - s.expires_at) / 60.0);
    insert into ledger (delta, reason, ref_id) values (-over * c.overtime_factor, 'dette_depassement', s.id);
  end if;
  update sessions set last_close_at = now(), overtime_min = overtime_min + over where id = s.id;
  return json_build_object('ok', true, 'overtime_min', over);
end $$;

-- ───────────────────────────── API de la PWA ─────────────────────────────

-- Premier compte connecté = propriétaire. Ensuite, plus personne d'autre.
create or replace function claim_owner() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  update app_config set owner = auth.uid() where id = 1 and owner is null;
  return is_owner();
end $$;

create or replace function edit_summary(p_reading uuid, p_summary text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'interdit'; end if;
  if char_length(btrim(coalesce(p_summary, ''))) < 50 then raise exception 'Résumé trop court.'; end if;
  update readings set summary = btrim(p_summary) where id = p_reading;
  return found;
end $$;

-- p_week_start = lundi de la semaine contrôlée ; p_real_minutes = ce qu'affiche Réglages > Temps d'écran.
create or replace function submit_audit(p_week_start date, p_app text, p_real_minutes int) returns json
language plpgsql security definer set search_path = public as $$
declare c app_config; t0 timestamptz; logged int; und int;
begin
  if not is_owner() then raise exception 'interdit'; end if;
  select * into c from app_config where id = 1;
  if exists (select 1 from audits where week_start = p_week_start and app = p_app) then
    return json_build_object('ok', false, 'status', 'refus', 'error', 'Semaine déjà contrôlée pour cette appli.');
  end if;
  t0 := p_week_start::timestamp at time zone c.tz;
  if t0 + interval '7 days' > now() then
    return json_build_object('ok', false, 'status', 'refus', 'error', 'Cette semaine n''est pas terminée.');
  end if;
  select coalesce(sum(minutes_granted + overtime_min), 0) into logged
    from sessions where app = p_app and started_at >= t0 and started_at < t0 + interval '7 days';
  und := greatest(p_real_minutes - logged - 10, 0);   -- 10 min de tolérance
  insert into audits values (p_week_start, p_app, p_real_minutes, logged, und);
  if und > 0 then
    insert into ledger (delta, reason) values (-und * c.overtime_factor, 'dette_audit');
  end if;
  return json_build_object('ok', true, 'logged', logged, 'undeclared', und);
end $$;

-- ───────────────────────────── Droits d'exécution ─────────────────────────────

revoke all on function gate_status(text, text), log_reading(text, text, int, text),
  start_session(text, text, int), close_session(text, text),
  claim_owner(), edit_summary(uuid, text), submit_audit(date, text, int), is_owner() from public;
grant execute on function gate_status(text, text), log_reading(text, text, int, text),
  start_session(text, text, int), close_session(text, text) to anon, authenticated;
grant execute on function claim_owner(), edit_summary(uuid, text), submit_audit(date, text, int), is_owner() to authenticated;
