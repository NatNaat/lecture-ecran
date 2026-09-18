-- Tests des règles. À exécuter dans Supabase > SQL Editor APRÈS schema.sql.
-- Le bloc se termine TOUJOURS par une erreur, exprès : c'est ce qui annule toutes ses écritures.
-- Succès = l'erreur « TOUS LES TESTS PASSENT » ; sinon c'est l'assertion fautive qui s'affiche.

do $$
declare k text; r json; bid uuid; long_txt text; long_txt2 text;
begin
  select secret into k from app_config where id = 1;
  delete from audits; delete from ledger; delete from sessions; delete from readings; delete from books;

  long_txt  := repeat('Le narrateur quitte Combray et découvre la mer à Balbec, entre ennui et éblouissement. ', 10);
  long_txt2 := repeat('Swann comprend trop tard que son amour pour Odette tenait surtout à une petite phrase de Vinteuil. ', 10);

  -- mauvais secret
  begin
    perform gate_status('faux', 'TikTok');
    raise exception 'ÉCHEC : mauvais secret accepté';
  exception when sqlstate '28000' then null;
  end;

  insert into books (title, total_pages, current_page, started_at)
    values ('Test', 300, 10, now() - interval '2 hours') returning id into bid;

  r := gate_status(k, 'TikTok');
  assert (r->>'allowed')::boolean = false, 'bloqué sans session';
  assert r->'books'->>0 = 'Test — p. 10', 'libellé du livre';

  r := log_reading(k, 'Test — p. 10', 10, long_txt);
  assert (r->>'ok')::boolean = false, 'page non avancée refusée';
  r := log_reading(k, 'Test — p. 10', 400, long_txt);
  assert (r->>'ok')::boolean = false, 'page au-delà du livre refusée';
  r := log_reading(k, 'Test — p. 10', 30, 'trop court');
  assert (r->>'ok')::boolean = false, 'résumé trop court refusé';
  r := log_reading(k, 'Inconnu — p. 0', 30, long_txt);
  assert (r->>'ok')::boolean = false, 'livre inconnu refusé';

  r := start_session(k, 'TikTok', 5);
  assert (r->>'ok')::boolean = false, 'solde insuffisant refusé';

  r := log_reading(k, 'Test — p. 10', 30, long_txt);
  assert (r->>'ok')::boolean, 'lecture valide acceptée : ' || coalesce(r->>'error', '');
  assert (r->>'balance_min')::int = 20, '20 pages = 20 min';
  assert (select current_page from books where id = bid) = 30, 'page courante mise à jour';

  r := log_reading(k, 'Test — p. 30', 140, long_txt2);
  assert (r->>'ok')::boolean = false, 'plus de 100 pages d''un coup refusées';

  update readings set created_at = now() - interval '3 hours';
  r := log_reading(k, 'Test — p. 30', 50, long_txt);
  assert (r->>'ok')::boolean = false, 'résumé en double refusé';
  r := log_reading(k, 'Test — p. 30', 50, long_txt2);
  assert (r->>'ok')::boolean, 'deuxième lecture acceptée : ' || coalesce(r->>'error', '');

  r := start_session(k, 'TikTok', 31);
  assert (r->>'ok')::boolean = false, 'plafond par session';
  r := start_session(k, 'TikTok', 10);
  assert (r->>'ok')::boolean, 'session accordée';
  assert (gate_status(k, 'TikTok')->>'allowed')::boolean, 'TikTok ouvert';
  assert (gate_status(k, 'Instagram')->>'allowed')::boolean = false, 'Instagram reste bloqué';
  assert (gate_status(k, 'TikTok')->>'balance_min')::int = 30, 'solde débité (40 - 10)';

  -- fermeture dans les temps : pas de dette
  r := close_session(k, 'TikTok');
  assert (r->>'overtime_min')::int = 0, 'pas de dépassement';

  -- dépassement : appli ouverte avant l'expiration, fermée 7 min après
  update sessions set started_at = now() - interval '17 minutes', expires_at = now() - interval '7 minutes',
                      last_open_at = now() - interval '9 minutes', last_close_at = now() - interval '12 minutes';
  assert (gate_status(k, 'TikTok')->>'allowed')::boolean = false, 'rebloqué après expiration';
  r := close_session(k, 'TikTok');
  assert (r->>'overtime_min')::int = 7, 'dépassement de 7 min mesuré';
  assert (gate_status(k, 'TikTok')->>'balance_min')::int = 16, 'dette x2 (30 - 14)';
  r := close_session(k, 'TikTok');
  assert (r->>'overtime_min')::int = 0, 'dépassement compté une seule fois';

  -- plafond journalier
  update app_config set daily_cap_min = 15;
  r := start_session(k, 'Instagram', 10);
  assert (r->>'ok')::boolean = false, 'plafond du jour';

  raise exception 'TOUS LES TESTS PASSENT (rien n''a été conservé)';
end $$;
