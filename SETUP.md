# Installation — Pages

Un suivi de lectures : livres, pages lues, résumés facultatifs, citations, série et hippo. Compte 15 minutes, une seule fois. Tout est gratuit.

(Jusqu'au 12/11/2026, l'app échangeait des pages contre du temps d'écran avec des raccourcis iOS et envoyait une notification le soir. Tout cela a été retiré ; l'historique reste dans git.)

## 1. La base (Supabase) — 10 min

1. Crée un compte sur <https://supabase.com> puis un projet (région : Paris ou Francfort). Le mot de passe de base demandé ne resservira pas.
2. **SQL Editor › New query** : colle tout `supabase/schema.sql`, **Run**. Résultat attendu : « Success ».
3. Exécute ensuite, dans l'ordre, les fichiers `supabase/migration-*.sql` (le dernier, `migration-2026-11-12-suivi.sql`, fait de l'app un simple suivi de lectures).
4. Nouvelle requête : colle `supabase/tests.sql`, **Run**. Résultat attendu : une *erreur* dont le texte est
   `TOUS LES TESTS PASSENT (rien n'a été conservé)`. C'est voulu : l'erreur finale annule les données de test.
5. **Authentication › Users › Add user** : ton email + un mot de passe, coche *Auto Confirm User*.
6. **Authentication › Sign In / Providers** : désactive *Allow new users to sign up*. (Même sans ça, seul le premier compte connecté à la web app devient propriétaire des données.)
7. **Project Settings › API** : copie *Project URL* et la clé *anon public* dans `config.js`.

## 2. La web app — 5 min

1. Publication sur GitHub Pages (dépôt public ; il ne contient que la clé anon, faite pour être publique) :
   **Settings › Pages › Deploy from a branch › main / (root)**.
2. Sur l'iPhone, ouvre `https://natnaat.github.io/lecture-ecran/` dans **Safari**, connecte-toi, puis **Partager › Sur l'écran d'accueil**.
3. Onglet **Livres** › Ajouter : le livre que tu lis, avec la page où tu en es.

## 3. Garder la base éveillée — rien à faire

Un projet Supabase gratuit s'endort après 7 jours sans activité. La tâche GitHub `.github/workflows/keepalive.yml` appelle la base chaque matin (onglet **Actions** du dépôt). GitHub met en pause les tâches planifiées d'un dépôt sans aucun commit pendant 60 jours : si tu reçois un mail de GitHub à ce sujet, rouvre l'onglet Actions et clique **Enable workflow**. La tâche `verif.yml` parcourt toute l'app en mode démo à chaque envoi : une croix rouge sur GitHub signale une régression.
