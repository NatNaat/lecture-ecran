-- Tests des règles. À exécuter dans Supabase > SQL Editor APRÈS schema.sql et les migrations.
-- Le bloc se termine TOUJOURS par une erreur, exprès : c'est ce qui annule toutes ses écritures.
-- Succès = l'erreur « TOUS LES TESTS PASSENT » ; sinon c'est l'assertion fautive qui s'affiche.

do $$
declare k text; r json; bid uuid;
begin
  select secret into k from app_config where id = 1;
  delete from audits; delete from ledger; delete from sessions; delete from readings; delete from books;

  -- mauvais secret
  begin
    perform log_reading('faux', 'Test — p. 10', 20, '');
    raise exception 'ÉCHEC : mauvais secret accepté';
  exception when sqlstate '28000' then null;
  end;

  insert into books (title, total_pages, current_page, started_at)
    values ('Test', 300, 10, now() - interval '2 hours') returning id into bid;

  r := log_reading(k, 'Test — p. 10', 10, '');
  assert (r->>'ok')::boolean = false, 'page non avancée refusée';
  r := log_reading(k, 'Test — p. 10', 400, '');
  assert (r->>'ok')::boolean = false, 'page au-delà du livre refusée';
  r := log_reading(k, 'Inconnu — p. 0', 30, '');
  assert (r->>'ok')::boolean = false, 'livre inconnu refusé';

  r := log_reading(k, 'Test — p. 10', 30, null);
  assert (r->>'ok')::boolean, 'lecture sans résumé acceptée : ' || coalesce(r->>'error', '');
  assert (r->>'pages')::int = 20, '20 pages comptées';
  assert (select current_page from books where id = bid) = 30, 'page courante mise à jour';
  assert (select summary from readings where id = (r->>'reading_id')::uuid) = '', 'résumé vide enregistré';

  r := log_reading(k, 'Test — p. 30', 200, 'Cent soixante-dix pages d''un coup, avec un résumé court.');
  assert (r->>'ok')::boolean, 'grosse séance acceptée : ' || coalesce(r->>'error', '');

  r := log_reading(k, 'Test — p. 200', 300, 'Fin.');
  assert (r->>'ok')::boolean, 'dernière page acceptée';
  assert (select status from books where id = bid) = 'fini', 'livre fini à la dernière page';

  raise exception 'TOUS LES TESTS PASSENT (rien n''a été conservé)';
end $$;
