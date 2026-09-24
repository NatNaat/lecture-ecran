-- À exécuter une fois dans Supabase › SQL Editor. Ajoute : type de livre (prépa / plaisir), bonus de minutes
-- pour la prépa, petites séances à une phrase, et un rappel du soir qui nomme le livre et la page.
-- Rejouable sans risque ; reprend aussi les colonnes de la migration du 23/09 au cas où elle n'aurait pas été passée.
alter table app_config add column if not exists goal_pages int not null default 15 check (goal_pages > 0);
alter table app_config add column if not exists prepa_factor numeric not null default 1.5 check (prepa_factor >= 1);
alter table books add column if not exists target_date date;
alter table books add column if not exists kind text not null default 'plaisir' check (kind in ('prepa','plaisir'));
grant update (title, author, cover_url, total_pages, status, finished_at, target_date, kind) on books to authenticated;
grant update (apps, session_cap_min, daily_cap_min, player, goal_pages) on app_config to authenticated;

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
    'pages', n, 'balance_min', greatest(_balance(), 0), 'debt_min', greatest(-_balance(), 0),
    'max_minutes', greatest(least(_balance(), c.session_cap_min), 0));
end $$;

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
revoke all on function evening_status(text) from public;
grant execute on function evening_status(text) to anon, authenticated;

select title, kind from books where status = 'en_cours';   -- test : tes livres en cours, tous « plaisir » pour l'instant
select evening_status(secret) from app_config;             -- test : le message doit nommer un livre et sa page
