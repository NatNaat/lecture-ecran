# Pages

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un seul utilisateur : Anatole, étudiant en prépa D2 à Rennes, sur iPhone (PWA plein écran ajoutée à l'écran d'accueil), le plus souvent le soir, un livre à la main. Il est daltonien. Personne d'autre n'y accède ; l'app ne sera pas partagée.

## Product Purpose

Un suivi de mes lectures : les livres en cours, finis ou abandonnés, les pages lues chaque jour, un résumé quand j'en ai envie, les citations à garder, et de quoi ne pas tout oublier (révision espacée des livres prépa, souvenirs des livres plaisir). L'hippo, la série, les plumes et le placard rendent le rituel agréable.

Jusqu'au 12/11/2026, l'app s'appelait « Pages contre minutes » et échangeait la lecture contre du temps d'écran (1 page résumée = 1 minute sur une appli bloquée par un raccourci iOS, contrôle hebdo, dette). Il a tout retiré, raccourcis et notification du soir compris : ça ne le poussait pas vraiment à lire. Réussite aujourd'hui : **lire régulièrement et garder une trace de ce qu'il lit**.

## Positioning

Un carnet de lecture personnel, pas un réseau social ni un outil de contrôle : chaque séance est rattachée à une œuvre et à un intervalle de pages précis, et le fil de lecture d'un livre se relit comme un journal.

## Operating Context

- **Chaîne** : la PWA (`index.html`, mode démo `?demo`) lit et écrit la base Supabase (`supabase/schema.sql` + migrations). Plus de raccourcis iOS ni de notification.
- **Rituels** : lancer une séance avec « Lire » (chrono) ou noter après coup « J'ai lu » (page atteinte, résumé facultatif) ; le dimanche, bilan de la semaine ; chaque jour au plus un moment de mémoire (révision prépa ou souvenir).
- **Hébergement** : GitHub Pages (`natnaat.github.io/lecture-ecran`), Supabase offre gratuite ; un seul fichier `index.html`, sans build ; service worker qui revalide toujours.
- **Vocabulaire** : objectif du jour, série (avec gel), plumes (monnaie), placard (cosmétiques), quêtes de la semaine, succès, niveau, fil de lecture, citation (ligne « > » d'un résumé), révision prépa, souvenir.

## Capabilities and Constraints

- La page courante d'un livre avance seulement par les lectures enregistrées (fonction `log_reading`) ; le résumé est facultatif et s'ajoute ou se corrige après coup.
- Recherche de livres : Google Books, BnF, Open Library ; couvertures haute résolution avec repli.
- Gamification recalculée depuis les lectures (rien à stocker) ; seuls achats, équipement, gels, cadeaux et mémoire sont enregistrés (`app_config.player`).
- Les anciennes tables du temps d'écran (`sessions`, `ledger`, `audits`, `push_*`) restent dans la base avec leur historique ; seul le succès « Bon élève » lit encore `audits`, et il ne s'affiche que s'il a été gagné.
- Toute évolution touchant la base passe par une migration `supabase/migration-<date>-*.sql` que lui seul exécute.
- Non décidé : rien d'ouvert à ce jour.

## Brand Commitments

- **Même monde que son Cockpit D2** : Bricolage Grotesque + IBM Plex Sans, mode sombre, et **la même mascotte hippo en pixel art**. Depuis la refonte du 12/11/2026 (la même que le Cockpit, esprit Arc/Dia, pensée pour le téléphone) : thème Graphite par défaut avec accent neutre (le mauve reste à l'hippo), cadres de 1 px, rayons courts (8 px, 10 px pour les cartes, 16 px pour ce qui flotte), boutons plats sans relief, aucune pilule, dock flottant en bas avec un fond qui glisse sous l'onglet actif, sous-onglets soulignés, ressorts discrets. Les règles sont dans le bloc `REFONTE NOV. 2026` à la fin de la feuille de style. Confirmé le 23/09/2026 : l'hippo et la gamification sont **l'identité de l'app**, à développer sobrement. L'hippo n'a pas de nom (« ton hippo »).
- Ton : un objet à soi, pas un produit. Sobre : il a fait retirer 3D, flou, halos et modèles téléchargés ; une chose à la fois, jamais de texte qui n'ajoute rien.
- Familles de couleurs fixées par lui : série ambre, livres sauge, temps de lecture sarcelle, écriture/niveau prune, pages lavande.

## Evidence on Hand

Données réelles dans sa base Supabase (en usage depuis le 18/09/2026) ; jeu de démonstration intégré (`?demo`). Aucun témoignage, chiffre externe ni comparaison : ne rien inventer.

## Product Principles

1. Noter une lecture doit prendre quelques secondes ; écrire davantage reste un choix.
2. Chaque séance a une œuvre et des pages derrière elle.
3. Les livres sont les héros ; les chiffres et les réglages sont rangés au cagibi.
4. L'hippo porte l'émotion, jamais l'information : rien ne repose sur lui pour comprendre.
5. Chaque écran doit se lire d'un coup d'œil, le soir, fatigué.

## Accessibility & Inclusion

Daltonisme : aucune information ne passe par la couleur seule (motifs, libellés, chiffres toujours présents). Zones tactiles ≥ 36 px, cible 44 px pour les actions principales ; `prefers-reduced-motion` respecté.
