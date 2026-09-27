-- À exécuter une fois dans Supabase › SQL Editor (rejouable sans risque).
-- 1. ping()            : signe de vie pour la tâche GitHub « Garder la base éveillée ».
-- 2. durée des séances : readings.duration_min (bouton Lire) ; log_reading renvoie l'identifiant de la lecture.
-- 3. notifications     : abonnements Web Push, journal des envois, logique du rappel du soir et du contrôle du lundi,
--                        tâche pg_cron qui appelle la fonction Edge « rappel » toutes les 5 minutes.
-- Prérequis pour la partie 3 : la fonction Edge « rappel » est déployée (voir SETUP.md › 6). Sinon, rien de grave :
-- la tâche échoue en silence jusqu'à ce qu'elle existe.

-- ───── 1. Signe de vie ─────
create or replace function ping() returns json
language sql stable security definer set search_path = public as $$ select json_build_object('ok', true, 'at', now()) $$;
revoke all on function ping() from public;
grant execute on function ping() to anon, authenticated;

-- ───── 2. Durée des séances ─────
alter table readings add column if not exists duration_min int check (duration_min is null or duration_min between 0 and 720);
grant update (duration_min) on readings to authenticated;
drop policy if exists owner_update on readings;
create policy owner_update on readings for update to authenticated using (is_owner()) with check (is_owner());

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

-- ───── 3. Notifications du soir ─────
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
alter table push_subs enable row level security;
alter table push_log  enable row level security;
drop policy if exists owner_read on push_subs;
create policy owner_read on push_subs for select to authenticated using (is_owner());
drop policy if exists owner_read on push_log;
create policy owner_read on push_log for select to authenticated using (is_owner());
grant select on push_subs, push_log to authenticated;

create or replace function _suggested_book(p_fresh boolean) returns books
language sql stable security definer set search_path = public as $$
  select b.* from books b left join lateral (select max(r.created_at) m from readings r where r.book_id = b.id) l on true
  where b.status = 'en_cours'
  order by case when p_fresh and b.kind = 'plaisir' then 0 else 1 end, coalesce(l.m, b.started_at) desc limit 1
$$;

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

create or replace function rappel_done(p_secret text, p_kind text, p_gone text[] default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare c app_config;
begin
  perform _check_secret(p_secret);
  select * into c from app_config where id = 1;
  if p_kind in ('rdv', 'audit') then insert into push_log (kind, day) values (p_kind, (now() at time zone c.tz)::date) on conflict do nothing; end if;
  delete from push_subs where endpoint = any(coalesce(p_gone, '{}'));
end $$;

revoke all on function rappel_due(text, boolean), rappel_done(text, text, text[]), save_push(text, text, text), drop_push(text) from public;
grant execute on function rappel_due(text, boolean), rappel_done(text, text, text[]) to anon, authenticated;
grant execute on function save_push(text, text, text), drop_push(text) to authenticated;
revoke all on function _suggested_book(boolean) from public, anon, authenticated;

-- Planification : pg_cron appelle la fonction Edge toutes les 5 minutes (heure de Paris calculée en SQL).
-- Si ces deux lignes échouent, active pg_cron et pg_net dans Database › Extensions puis relance le fichier.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('rappel-lecture', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://tibtyzbwohuwfngmxluc.supabase.co/functions/v1/rappel',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYnR5emJ3b2h1d2ZuZ214bHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NDk3MDQsImV4cCI6MjEwNTIyNTcwNH0.gs34opoO5zWE4XuH8gZYL4Q5nqPRmfmLC9Vfk5nJ35g', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYnR5emJ3b2h1d2ZuZ214bHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NDk3MDQsImV4cCI6MjEwNTIyNTcwNH0.gs34opoO5zWE4XuH8gZYL4Q5nqPRmfmLC9Vfk5nJ35g',
                                  'x-rappel-secret', (select secret from public.app_config where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000);
$cron$);
select cron.schedule('purge-historique-cron', '17 3 * * *', $cron$ delete from cron.job_run_details where end_time < now() - interval '7 days' $cron$);

notify pgrst, 'reload schema';

-- Tests
select ping();                                              -- doit renvoyer {"ok": true, …}
select rappel_due(secret) from app_config;                  -- avant d'activer les notifications : {"due": false, "reason": "aucun abonnement"}
select jobname, schedule, active from cron.job;             -- rappel-lecture et purge-historique-cron, actives
