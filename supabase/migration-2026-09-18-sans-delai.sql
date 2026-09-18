-- Supprime le délai minimum entre deux déclarations de lecture (45 s par page).
-- À exécuter une fois dans Supabase > SQL Editor.
update app_config set sec_per_page = 0 where id = 1;
alter table app_config alter column sec_per_page set default 0;
select sec_per_page from app_config;   -- doit afficher 0
