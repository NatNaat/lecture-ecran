# Pages contre minutes

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un seul utilisateur : Anatole, étudiant en prépa D2 à Rennes, sur iPhone (PWA plein écran ajoutée à l'écran d'accueil), le plus souvent le soir, un livre à la main. Il est daltonien. Personne d'autre n'y accède ; l'app ne sera pas partagée.

## Product Purpose

Échanger de la lecture contre du temps d'écran : 1 page lue et résumée = 1 minute sur une appli bloquée (TikTok, Instagram, YouTube). Le blocage vit dans un raccourci iOS ; cette web app est la bibliothèque, le carnet de résumés, le tableau de bord et la maison de la mascotte.

Réussite, confirmée par lui (23/09/2026) : **lire plus, tous les jours** (la série et l'objectif quotidien tiennent) et **passer réellement moins de temps sur les applis bloquées** (le contrôle hebdomadaire le montre). Les résumés utiles à la prépa et le plaisir d'ouvrir l'app sont des bénéfices, pas le critère.

## Positioning

Un pacte avec soi-même dont les règles sont **hors de portée** : le solde, les validations et la dette vivent côté serveur (Supabase) et le portier est un raccourci iOS qu'on déclenche à l'ouverture de l'appli bloquée. Chaque minute gagnée est adossée à un résumé rattaché à une œuvre et à un intervalle de pages précis — pas à un simple minuteur ni à une déclaration sur l'honneur.

## Operating Context

- **Chaîne** : automatisations Raccourcis iOS (« app ouverte / fermée ») → raccourci `Portier` (`shortcuts/`, généré et signé par `build.py`) → fonctions SQL Supabase (`supabase/schema.sql`) ; la PWA (`index.html`, mode démo `?demo`) lit la même base. Raccourci `Rappel` lancé par une automatisation à 20 h.
- **Rituels** : déclarer une lecture (page atteinte + résumé, dictée possible) ; le soir, rappel si l'objectif n'est pas atteint ; le lundi, contrôle hebdomadaire (reporter le temps d'écran réel d'iOS, écart = dette doublée) ; le dimanche, bilan de la semaine ; à J+7 et J+30, relire un ancien résumé.
- **Hébergement** : GitHub Pages (`natnaat.github.io/lecture-ecran`), Supabase offre gratuite ; un seul fichier `index.html`, sans build ; service worker qui revalide toujours.
- **Vocabulaire** : réserve d'écran (minutes), dette, objectif du jour, série (avec gel), plumes (monnaie), placard (cosmétiques), quêtes de la semaine, succès, niveau, fil de lecture, citation (ligne « > » d'un résumé), contrôle hebdo.

## Capabilities and Constraints

- Règles côté serveur uniquement ; la page courante d'un livre n'est jamais modifiable à la main ; le secret des raccourcis ne s'affiche que dans Réglages.
- Recherche de livres : Google Books, BnF, Open Library ; couvertures haute résolution avec repli.
- Gamification recalculée depuis les lectures (rien à stocker, rien à tricher) ; seuls achats, équipement, gels, cadeaux et relectures sont enregistrés (`app_config.player`).
- Gratuit, sans compte développeur Apple : pas d'API Temps d'écran, donc pas de blocage plus étanche que Raccourcis. Hors ligne = bloqué.
- Toute évolution touchant la base passe par une migration `supabase/migration-<date>-*.sql` que lui seul exécute.
- Non décidé : rien d'ouvert à ce jour.

## Brand Commitments

- **Même monde que son Cockpit D2** : lavande, Bricolage Grotesque + IBM Plex Sans, mode sombre, et **la même mascotte hippo en pixel art**. Confirmé le 23/09/2026 : l'hippo et la gamification sont **l'identité de l'app**, à développer sobrement. L'hippo n'a pas de nom (« ton hippo »).
- Ton : un objet à soi, pas un produit. Sobre : il a fait retirer 3D, flou, halos et modèles téléchargés ; une chose à la fois, jamais de texte qui n'ajoute rien.
- Familles de couleurs fixées par lui : série ambre, livres sauge, écran sarcelle, écriture/niveau prune, dette corail, pages lavande.

## Evidence on Hand

Données réelles dans sa base Supabase (en usage depuis le 18/09/2026) ; jeu de démonstration intégré (`?demo`). Aucun témoignage, chiffre externe ni comparaison : ne rien inventer.

## Product Principles

1. La règle vit ailleurs que dans la main qui veut tricher.
2. Une minute d'écran a toujours une page et un résumé derrière elle.
3. Les livres sont les héros ; les chiffres et les réglages sont rangés au cagibi.
4. L'hippo porte l'émotion, jamais l'information : rien ne repose sur lui pour comprendre.
5. Chaque écran doit se lire d'un coup d'œil, le soir, fatigué.

## Accessibility & Inclusion

Daltonisme : aucune information ne passe par la couleur seule (motifs, libellés, chiffres toujours présents). Zones tactiles ≥ 36 px, cible 44 px pour les actions principales ; `prefers-reduced-motion` respecté.
