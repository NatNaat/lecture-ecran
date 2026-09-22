-- À exécuter une fois dans Supabase › SQL Editor (projet existant). Ajoute : objectif du jour côté serveur,
-- date cible par livre, et la fonction du raccourci « Rappel ».
alter table app_config add column if not exists goal_pages int not null default 15 check (goal_pages > 0);
alter table books add column if not exists target_date date;
grant update (title, author, cover_url, total_pages, status, finished_at, target_date) on books to authenticated;
grant update (apps, session_cap_min, daily_cap_min, player, goal_pages) on app_config to authenticated;

-- Rappel du soir (raccourci « Rappel », automatisation à heure fixe) : un message tant que l'objectif du jour n'est pas atteint, sinon rien.
create or replace function evening_status(p_secret text) returns json
language plpgsql security definer set search_path = public as $$
declare c app_config; today int; yday int; msg text;
begin
  perform _check_secret(p_secret);
  select * into c from app_config where id = 1;
  select coalesce(sum(pages), 0) into today from readings where created_at >= _today_start();
  select coalesce(sum(pages), 0) into yday from readings where created_at >= _today_start() - interval '1 day' and created_at < _today_start();
  if today >= c.goal_pages then msg := null;
  elsif today = 0 and yday > 0 then msg := format('Ta série est en jeu : %s pages à lire et résumer avant minuit.', c.goal_pages);
  elsif today = 0 then msg := format('Pas encore lu aujourd''hui : %s pages pour l''objectif.', c.goal_pages);
  else msg := format('Encore %s pages pour l''objectif du jour (%s lues).', c.goal_pages - today, today);
  end if;
  return json_strip_nulls(json_build_object('pages_today', today, 'goal', c.goal_pages, 'message', msg));
end $$;
revoke all on function evening_status(text) from public;
grant execute on function evening_status(text) to anon, authenticated;
select evening_status(secret) from app_config;   -- test : doit renvoyer pages_today, goal et (sauf objectif atteint) message
