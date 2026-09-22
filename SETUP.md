# Installation — Pages contre minutes

Compte 30 à 40 minutes, une seule fois. Tout est gratuit.

## 1. La base (Supabase) — 10 min

1. Crée un compte sur <https://supabase.com> puis un projet (région : Paris ou Francfort). Le mot de passe de base demandé ne resservira pas.
2. **SQL Editor › New query** : colle tout `supabase/schema.sql`, **Run**. Résultat attendu : « Success ».
3. Nouvelle requête : colle `supabase/tests.sql`, **Run**. Résultat attendu : une *erreur* dont le texte est
   `TOUS LES TESTS PASSENT (rien n'a été conservé)`. C'est voulu : l'erreur finale annule les données de test.
   Tout autre message = une règle ne marche pas, dis-le-moi.
4. **Authentication › Users › Add user** : ton email + un mot de passe, coche *Auto Confirm User*.
5. **Authentication › Sign In / Providers** : désactive *Allow new users to sign up*. (Même sans ça, seul le premier compte connecté à la web app devient propriétaire des données.)
6. **Project Settings › API** : copie *Project URL* et la clé *anon public* dans `config.js`.

## 2. La web app — 5 min

1. Publication sur GitHub Pages (dépôt public ; il ne contient que la clé anon, faite pour être publique) :
   crée un dépôt vide `lecture-ecran` sur GitHub, puis dans ce dossier :
   ```bash
   git remote add origin https://github.com/NatNaat/lecture-ecran.git && git push -u origin main
   ```
   puis sur GitHub : **Settings › Pages › Deploy from a branch › main / (root)**.
2. Sur l'iPhone, ouvre `https://NatNaat.github.io/lecture-ecran/` dans **Safari**, connecte-toi, puis **Partager › Sur l'écran d'accueil**.
3. Onglet **Livres** › Ajouter : le livre que tu lis, avec la page où tu en es.
4. Onglet **Profil** › Réglages : vérifie la liste des applis bloquées (le nom doit être exactement celui que tu donneras aux automatisations).

## 3. Le raccourci « Portier » — 5 min

1. Envoie `shortcuts/Portier.shortcut` sur l'iPhone (AirDrop, ou dépose-le dans iCloud Drive et ouvre-le dans Fichiers) › **Ajouter le raccourci**.
2. Ouvre-le en édition (⋯). Dans le bloc **Dictionnaire** du haut, `url` et `cle` sont déjà remplies : remplace seulement `COLLE_ICI_LE_SECRET` par le secret affiché dans la web app › Profil › Raccourci iPhone.
3. Test : lance le raccourci à la main (sans entrée). Tu es renvoyé à l'écran d'accueil et un menu s'affiche : « est bloqué. Solde : … » avec *J'ai lu / Utiliser mon solde / Annuler*. Le nom de l'appli est vide, c'est normal : ce sont les automatisations qui le fournissent.
   À la première exécution iOS demande d'autoriser la connexion à supabase.co : **Toujours autoriser**.

Si l'import échoue ou qu'une action apparaît cassée, reconstruis-le à la main : voir l'annexe en bas.

## 4. Les automatisations — 1 min par appli

Raccourcis › **Automatisation › +** › **App**. Pour chaque appli bloquée, crée-en **deux** :

| Déclencheur | Réglage | Action |
|---|---|---|
| TikTok · **Est ouverte** | **Exécuter immédiatement**, *Notifier lors de l'exécution* : non | *Exécuter le raccourci* › Portier › (flèche ›) **Entrée** : `TikTok` |
| TikTok · **Est fermée** | idem | *Exécuter le raccourci* › Portier › **Entrée** : `fermeture TikTok` |

L'entrée est un bloc **Texte** contenant exactement le nom listé dans la web app.

## 5. Verrouiller les contournements — 5 min, avec un proche

Demande à quelqu'un de définir le **code Temps d'écran** (Réglages › Temps d'écran › Verrouiller les réglages) sans te le donner, puis :

- **Restrictions relatives au contenu › Achats › Suppression d'apps : Ne pas autoriser** — tu ne peux plus supprimer Raccourcis ni réinstaller TikTok « propre ».
- **Contenu web › Limiter les sites pour adultes › Ne jamais autoriser** : ajoute `tiktok.com`, `instagram.com`, `youtube.com`… pour fermer la porte Safari.
- Dans la web app (Profil), fais chaque lundi le **contrôle de la semaine** : tu reportes le temps réel lu dans Réglages › Temps d'écran ; tout écart de plus de 10 min devient une dette doublée. C'est la parade à « je désactive l'automatisation cinq minutes » — iOS ne permet pas de verrouiller l'app Raccourcis elle-même.

## 6. Le rappel du soir — 2 min

1. Exécute `supabase/migration-2026-09-23-rappel-cible.sql` dans Supabase › SQL Editor (une fois).
2. Importe `shortcuts/Rappel.shortcut` sur l'iPhone et colle ton secret dans le premier bloc, comme pour Portier.
3. Raccourcis › **Automatisation › +** › **Heure de la journée** › 20 h 00, tous les jours › **Exécuter immédiatement** › *Exécuter le raccourci* › Rappel.

Tant que l'objectif du jour n'est pas atteint, une notification te dit combien de pages il reste (et si ta série est en jeu). Objectif atteint : rien, pas de bruit.

## Limites connues

- Le blocage vit dans Raccourcis : il ne peut pas être aussi étanche que l'API Temps d'écran (réservée aux comptes développeur payants).
- Si Supabase est injoignable alors que tu as du réseau, le raccourci s'arrête sur une erreur et l'appli reste ouverte. Sans réseau du tout, tu es bloqué.
- À la fin du crédit, le minuteur sonne mais ne te sort pas de l'appli : chaque minute en plus est comptée double à la fermeture.
- Un projet Supabase gratuit s'endort après 7 jours sans aucune requête (réactivation en un clic sur supabase.com).
- Schémas d'URL pour rouvrir l'appli après déblocage : connus pour TikTok, Instagram, YouTube, X, Snapchat, Reddit. Pour une autre appli, rien ne se rouvre tout seul : tu la relances à la main (ou ajoute son schéma dans `app_config.app_urls`).

## Annexe — construire « Portier » à la main

Toutes les requêtes sont des **Obtenir le contenu de l'URL** : méthode **POST**, corps **JSON**, en-tête `apikey` = ta clé anon, vers `URL/rest/v1/rpc/NOM`. Tous les champs JSON sont de type Texte, et chaque requête contient `p_secret`.

1. *Si* **Entrée de raccourci** *contient* `fermeture` → requête `close_session` (`p_app` = Entrée de raccourci) → *Arrêter ce raccourci*. *Fin de si.*
2. *Obtenir l'adresse IP actuelle* (locale). *Si* elle *n'a aucune valeur* → *Aller à l'écran d'accueil* → *Afficher l'alerte* « Pas de réseau » → *Arrêter*. *Fin de si.*
3. Requête `gate_status` (`p_app` = Entrée de raccourci) → variable **Etat**. *Si* `Etat.state` *est* `open` → *Arrêter*. *Fin de si.*
4. *Aller à l'écran d'accueil*.
5. *Choisir dans le menu*, invite = `Etat.prompt`, éléments : **J'ai lu** / **Utiliser mon solde** / **Annuler**.
   - **J'ai lu** : *Choisir dans la liste* `Etat.books` → *Demander* un **nombre** (page atteinte) → *Demander* un **texte** (résumé) → requête `log_reading` (`p_book`, `p_page_end`, `p_summary`) → variable **Lecture**. *Si* `Lecture.status` *est* `ok` → alerte `Lecture.message` ; *sinon* → alerte `Lecture.error` → *Arrêter*.
   - **Utiliser mon solde** : rien.
   - **Annuler** : *Arrêter ce raccourci*.
6. *Demander* un **nombre** (minutes) → requête `start_session` (`p_app`, `p_minutes`) → variable **Session**.
7. *Si* `Session.status` *est* `ok` → *Démarrer le minuteur* pour `Session.minutes` minutes → *Ouvrir l'URL* `Session.open_url` ; *sinon* → alerte `Session.error`.
