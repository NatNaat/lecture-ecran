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
  app_urls        jsonb not null default '{"TikTok":"snssdk1233://","Instagram":"instagram://","YouTube":"youtube://","X":"twitter://","Snapchat":"snapchat://","Reddit":"reddit://"}',
  player          jsonb not null default '{}'::jsonb,         -- placard de l'hippo : achats, équipement, gels, cadeaux
  goal_pages      int  not null default 15 check (goal_pages > 0), -- objectif du jour (le rappel du soir le lit ici)
  prepa_factor    numeric not null default 1.5 check (prepa_factor >= 1)  -- minutes par page pour un livre « prépa »
);
alter table app_config add column if not exists player jsonb not null default '{}'::jsonb;
alter table app_config add column if not exists goal_pages int not null default 15 check (goal_pages > 0);
alter table app_config add column if not exists prepa_factor numeric not null default 1.5 check (prepa_factor >= 1);
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
  finished_at     timestamptz,
  target_date     date,                                   -- « finir avant le », facultatif
  kind            text not null default 'plaisir' check (kind in ('prepa','plaisir'))   -- une page « prépa » rapporte prepa_factor minutes
);

create table if not exists readings (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books(id) on delete restrict,
  page_start  int  not null,
  page_end    int  not null,
  pages       int  generated always as (page_end - page_start) stored,
  summary     text not null,
  created_at  timestamptz not null default now(),
  duration_min int check (duration_min is null or duration_min between 0 and 720),   -- durée de la séance (bouton Lire)
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

-- Notifications du soir : abonnements Web Push de l'iPhone et journal des envois (un par type et par jour).
create table if not exists push_subs (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now()
);
create table if not exists push_log (
  kind    text not null,
  day     date not null,
  sent_at timestamptz not null default now(),
  primary key (kind, day)
);

-- Colonnes ajoutées après coup (sans effet sur une installation neuve, utiles pour une base existante).
alter table books add column if not exists target_date date;
alter table readings add column if not exists duration_min int check (duration_min is null or duration_min between 0 and 720);
alter table books add column if not exists kind text not null default 'plaisir' check (kind in ('prepa','plaisir'));

-- ───────────────────────────── Accès ─────────────────────────────
-- La PWA (compte propriétaire) lit tout, mais n'écrit que ce qui ne permet pas de tricher :
-- le solde, les sessions et les lectures ne passent que par les fonctions ci-dessous.

alter table app_config enable row level security;
alter table books      enable row level security;
alter table readings   enable row level security;
alter table push_subs  enable row level security;
alter table push_log   enable row level security;
alter table sessions   enable row level security;
alter table ledger     enable row level security;
alter table audits     enable row level security;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select auth.uid() is not null and auth.uid() = (select owner from app_config where id = 1) $$;

do $$
declare t text;
begin
  foreach t in array array['app_config','books','readings','sessions','ledger','audits','push_subs','push_log'] loop
    execute format('drop policy if exists owner_read on %I', t);
    execute format('create policy owner_read on %I for select to authenticated using (is_owner())', t);
  end loop;
end $$;

drop policy if exists owner_insert on books;
create policy owner_insert on books for insert to authenticated with check (is_owner());
drop policy if exists owner_update on books;
create policy owner_update on books for update to authenticated using (is_owner()) with check (is_owner());
drop policy if exists owner_delete on books;
create policy owner_delete on books for delete to authenticated using (is_owner());
drop policy if exists owner_update on readings;
create policy owner_update on readings for update to authenticated using (is_owner()) with check (is_owner());   -- seule la durée est modifiable (droit par colonne)  -- échoue s'il y a des lectures (FK restrict)

drop policy if exists owner_update on app_config;
create policy owner_update on app_config for update to authenticated using (is_owner()) with check (is_owner());

revoke all on app_config, books, readings, sessions, ledger, audits from anon, authenticated;
grant select on app_config, books, readings, sessions, ledger, audits, push_subs, push_log to authenticated;
grant insert, delete on books to authenticated;
-- current_page n'est pas modifiable à la main : sinon on pourrait « relire » les mêmes pages.
grant update (duration_min) on readings to authenticated;
grant update (title, author, cover_url, total_pages, status, finished_at, target_date, kind) on books to authenticated;
grant update (apps, session_cap_min, daily_cap_min, player, goal_pages) on app_config to authenticated;

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
declare c app_config; b books; n int; need int; credit int; last_at timestamptz; wait_min int; rid uuid; txt text;
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
  -- Petite séance (5 pages ou moins) : une phrase suffit ; au-delà, la règle habituelle.
  need := case when n <= 5 then 60 else least(c.summary_base + c.summary_per_page * n, c.summary_max_req) end;
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
  credit := case when b.kind = 'prepa' then ceil(n * c.prepa_factor)::int else n end;
  insert into ledger (delta, reason, ref_id) values (credit, 'lecture', rid);

  return json_build_object('ok', true, 'status', 'ok',
    'message', format('+%s min pour %s pages. ', credit, n) || case when _balance() < 0 then format('Dette restante : %s min.', -_balance()) else format('Solde : %s min.', _balance()) end,
    'pages', n, 'reading_id', rid, 'balance_min', greatest(_balance(), 0), 'debt_min', greatest(-_balance(), 0),
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

-- Rappel du soir (raccourci « Rappel », automatisation à heure fixe) : un message tant que l'objectif du jour n'est pas atteint, sinon rien.
create or replace function evening_status(p_secret text) returns json
language plpgsql security definer set search_path = public as $$
declare c app_config; today int; yday int; msg text; bk books; at_book text;
begin
  perform _check_secret(p_secret);
  select * into c from app_config where id = 1;
  select coalesce(sum(pages), 0) into today from readings where created_at >= _today_start();
  select coalesce(sum(pages), 0) into yday from readings where created_at >= _today_start() - interval '1 day' and created_at < _today_start();
  -- Livre proposé : le dernier lu parmi les livres en cours ; tant que rien n'est lu aujourd'hui, un livre plaisir d'abord (même règle que l'app).
  select b.* into bk from books b left join lateral (select max(r.created_at) m from readings r where r.book_id = b.id) l on true
    where b.status = 'en_cours'
    order by case when today = 0 and b.kind = 'plaisir' then 0 else 1 end, coalesce(l.m, b.started_at) desc limit 1;
  at_book := case when bk.id is null then '' else format(' %s, p. %s.', bk.title, bk.current_page) end;
  if today >= c.goal_pages then msg := null;
  elsif today = 0 and yday > 0 then msg := format('Rendez-vous lecture : ta série est en jeu.%s Cinq pages suffisent pour la garder.', at_book);
  elsif today = 0 then msg := format('Rendez-vous lecture.%s Cinq pages suffisent pour commencer.', at_book);
  else msg := format('Encore %s pages pour l''objectif du jour.%s', c.goal_pages - today, at_book);
  end if;
  return json_strip_nulls(json_build_object('pages_today', today, 'goal', c.goal_pages, 'message', msg, 'book', bk.title));
end $$;

-- Livre à proposer : le dernier lu parmi les livres en cours ; tant que rien n'est lu aujourd'hui, un livre plaisir d'abord (même règle que l'app).
create or replace function _suggested_book(p_fresh boolean) returns books
language sql stable security definer set search_path = public as $$
  select b.* from books b left join lateral (select max(r.created_at) m from readings r where r.book_id = b.id) l on true
  where b.status = 'en_cours'
  order by case when p_fresh and b.kind = 'plaisir' then 0 else 1 end, coalesce(l.m, b.started_at) desc limit 1
$$;

-- L'app enregistre (ou rafraîchit) l'abonnement de l'iPhone à chaque ouverture.
create or replace function save_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'interdit'; end if;
  insert into push_subs (endpoint, p256dh, auth) values (p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, seen_at = now();
end $$;
create or replace function drop_push(p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'interdit'; end if;
  delete from push_subs where endpoint = p_endpoint;
end $$;

-- Appelée toutes les 5 minutes (pg_cron → fonction Edge « rappel ») : y a-t-il une notification à envoyer maintenant ?
-- Rendez-vous lecture : à l'heure choisie dans l'app (heure de Paris), une fois par jour, seulement si l'objectif n'est pas atteint.
-- Contrôle hebdo : le lundi à la même heure, tant qu'il reste une appli à contrôler pour la semaine passée.
create or replace function rappel_due(p_secret text, p_test boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare c app_config; loc timestamp; today date; rdv time; pages_today int; yday int; bk books; subs json; at_book text; title text; body text;
begin
  perform _check_secret(p_secret);
  select * into c from app_config where id = 1;
  select coalesce(json_agg(json_build_object('endpoint', endpoint, 'keys', json_build_object('p256dh', p256dh, 'auth', auth))), '[]'::json) into subs from push_subs;
  if json_array_length(subs) = 0 then return json_build_object('due', false, 'reason', 'aucun abonnement'); end if;
  loc := now() at time zone c.tz; today := loc::date;
  -- Heure du rendez-vous, plafonnée à 23 h 55 (dernier passage de pg_cron dans la journée) ; valeur illisible → 21 h.
  begin rdv := least(coalesce(nullif(c.player->>'rdv', ''), '21:00')::time, time '23:55'); exception when others then rdv := time '21:00'; end;
  select coalesce(sum(pages), 0) into pages_today from readings where created_at >= _today_start();
  select coalesce(sum(pages), 0) into yday from readings where created_at >= _today_start() - interval '1 day' and created_at < _today_start();
  bk := _suggested_book(pages_today = 0);
  at_book := case when bk.id is null then '' else format('%s, p. %s. ', bk.title, bk.current_page) end;
  if p_test then
    return json_build_object('due', true, 'kind', 'test', 'title', 'Rendez-vous lecture', 'body', at_book || 'Ceci est un essai : touche la notification pour ouvrir le mode lecture.', 'url', '?lire', 'subs', subs);
  end if;
  if loc::time >= rdv and not exists (select 1 from push_log where kind = 'rdv' and day = today) then
    if pages_today >= c.goal_pages then
      insert into push_log (kind, day) values ('rdv', today) on conflict do nothing;   -- objectif déjà atteint : pas de bruit
    else
      if pages_today = 0 and yday > 0 then title := 'Ta série est en jeu'; body := at_book || 'Cinq pages suffisent pour la garder.';
      elsif pages_today = 0 then title := 'Rendez-vous lecture'; body := at_book || 'Cinq pages suffisent pour commencer.';
      else title := format('Encore %s pages', c.goal_pages - pages_today); body := at_book || 'L''objectif du jour est tout près.';
      end if;
      return json_build_object('due', true, 'kind', 'rdv', 'title', title, 'body', btrim(body), 'url', '?lire', 'subs', subs);
    end if;
  end if;
  if extract(isodow from today) = 1 and loc::time >= rdv and not exists (select 1 from push_log where kind = 'audit' and day = today)
     and exists (select 1 from unnest(c.apps) a where not exists (select 1 from audits x where x.week_start = today - 7 and x.app = a)) then
    return json_build_object('due', true, 'kind', 'audit', 'title', 'Contrôle de la semaine', 'body', 'Deux minutes pour reporter ton temps d''écran réel de la semaine passée.', 'url', '?audit', 'subs', subs);
  end if;
  return json_build_object('due', false);
end $$;

-- Après l'envoi : on note le jour (plus rien jusqu'à demain) et on oublie les abonnements que le service Push déclare morts.
create or replace function rappel_done(p_secret text, p_kind text, p_gone text[] default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare c app_config;
begin
  perform _check_secret(p_secret);
  select * into c from app_config where id = 1;
  if p_kind in ('rdv', 'audit') then insert into push_log (kind, day) values (p_kind, (now() at time zone c.tz)::date) on conflict do nothing; end if;
  delete from push_subs where endpoint = any(coalesce(p_gone, '{}'));
end $$;

-- Signe de vie quotidien (tâche GitHub « Garder la base éveillée ») : empêche la mise en pause du projet gratuit.
create or replace function ping() returns json
language sql stable security definer set search_path = public as $$ select json_build_object('ok', true, 'at', now()) $$;

-- ───────────────────────────── Droits d'exécution ─────────────────────────────

revoke all on function gate_status(text, text), log_reading(text, text, int, text), evening_status(text), ping(),
  rappel_due(text, boolean), rappel_done(text, text, text[]), save_push(text, text, text), drop_push(text),
  start_session(text, text, int), close_session(text, text),
  claim_owner(), edit_summary(uuid, text), submit_audit(date, text, int), is_owner() from public;
grant execute on function gate_status(text, text), log_reading(text, text, int, text), evening_status(text), ping(),
  rappel_due(text, boolean), rappel_done(text, text, text[]),
  start_session(text, text, int), close_session(text, text) to anon, authenticated;
grant execute on function claim_owner(), edit_summary(uuid, text), submit_audit(date, text, int), is_owner(), save_push(text, text, text), drop_push(text) to authenticated;
revoke all on function _suggested_book(boolean) from public, anon, authenticated;
