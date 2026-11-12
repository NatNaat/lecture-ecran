-- 12/11/2026 : « Pages » devient un suivi de lectures.
-- Plus d'échange pages contre minutes, plus de raccourcis iOS, plus de notification du soir.
-- À exécuter une fois dans Supabase › SQL Editor (tout coller, Run). Les tables d'avant (sessions, ledger, audits, push_subs, push_log)
-- restent telles quelles avec leur historique ; plus rien ne les alimente.

-- ───── 1. Enregistrer une lecture : la page atteinte suffit, le résumé est facultatif ─────
-- Retirés : minimum de caractères, plafond de pages par résumé, délai entre deux lectures, refus des résumés trop proches, minutes créditées.
create or replace function log_reading(p_secret text, p_book text, p_page_end int, p_summary text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare b books; rid uuid;
begin
  perform _check_secret(p_secret);
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

  insert into readings (book_id, page_start, page_end, summary)
    values (b.id, b.current_page, p_page_end, btrim(coalesce(p_summary, ''))) returning id into rid;
  update books set current_page = p_page_end,
                   status = case when total_pages is not null and p_page_end >= total_pages then 'fini' else status end,
                   finished_at = case when total_pages is not null and p_page_end >= total_pages then now() else finished_at end
    where id = b.id;

  return json_build_object('ok', true, 'status', 'ok', 'pages', p_page_end - b.current_page, 'reading_id', rid);
end $$;

-- ───── 2. Modifier un résumé : on peut aussi en ajouter un après coup, ou le vider ─────
create or replace function edit_summary(p_reading uuid, p_summary text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'interdit'; end if;
  update readings set summary = btrim(coalesce(p_summary, '')) where id = p_reading;
  return found;
end $$;

-- ───── 3. Notification du soir : la tâche planifiée s'arrête ─────
do $$ begin perform cron.unschedule('rappel-lecture'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('purge-historique-cron'); exception when others then null; end $$;

-- Vérification : doit afficher 0 ligne (plus aucune tâche du rappel)
select jobname from cron.job where jobname in ('rappel-lecture', 'purge-historique-cron');
