-- Placard de l'hippo : achats, équipement, gels de série et cadeaux du jour, dans une colonne JSON.
-- À exécuter une fois dans Supabase > SQL Editor.
alter table app_config add column if not exists player jsonb not null default '{}'::jsonb;
grant update (player) on app_config to authenticated;
select player from app_config;   -- doit afficher {}
