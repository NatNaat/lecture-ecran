# Pages contre minutes

**Ce que c'est.** Une appli personnelle (un seul utilisateur, Anatole, étudiant en prépa D2) qui échange de la lecture contre du temps d'écran : 1 page lue et résumée = 1 minute sur une appli bloquée (TikTok, Instagram, YouTube). Le blocage vit dans un raccourci iOS ; cette web app est la bibliothèque, le carnet de résumés et le tableau de stats.

**Qui et où.** Lui seul, sur iPhone (PWA plein écran), souvent le soir, un livre à la main. Il est daltonien : aucune information ne passe par la couleur seule.

**Ce qu'il vient y faire.** Retrouver ses livres, déclarer une lecture (page atteinte + résumé), relire le fil de ses résumés œuvre par œuvre, ajouter un livre, et de temps en temps regarder ses stats, faire le contrôle hebdomadaire, changer un réglage.

**Ce qui doit rester vrai.** Les règles sont côté serveur (Supabase) ; la page courante d'un livre n'est jamais modifiable à la main ; le secret des raccourcis ne s'affiche que dans les réglages. Un seul fichier `index.html`, sans build, hébergé sur GitHub Pages. Gratuit.

**Le ton.** Un objet à soi, pas un produit : sa bibliothèque. Les livres sont les héros ; les chiffres et les réglages sont rangés au cagibi.
