---
name: plan-sprint
description: Decoupe les epics en sprints et en stories de taille "un agent, une branche, une PR", avec dependances et proprietaire de fichiers sans chevauchement, puis initialise docs/sprint.md et les stories du sprint dans sprint-status.yaml. A utiliser au setup, a chaque fin de sprint, ou quand l'humain dit "planifie le sprint".
---
# Planifier un sprint

Entrées : `docs/PRD.md`, `docs/system-design.md`, `docs/epics.md`, la dernière rétro (`docs/retro/`), l'état.

1. **Epic courante** : la première epic qui n'est pas `done`. Si toutes sont `done`, rien à planifier : la boucle se termine.
2. **Stories** : chaque critère d'acceptation de l'epic doit être couvert par une story. Une story :
   - tient en une PR relisible (moins de 400 lignes utiles ; au-delà, découpe) ;
   - est testable seule et livre un comportement visible ou une fondation explicite ;
   - possède une liste de **fichiers ou globs** (`files`) que personne d'autre ne touche pendant le sprint.
3. **Fondation d'abord** : schéma de données, layout, configuration partagée vont dans **une** story `-01`, dont les autres dépendent.
   Après son merge, les stories parallèles ne touchent plus ces fichiers (ou alors via une story dédiée).
4. **Parallélisme** : vise au moins `policy.max_parallel_devs` stories indépendantes après la fondation. Demande à l'agent `architect`
   de valider la carte des fichiers.
5. Taille du sprint : 4 à 8 stories. Leçons de la rétro précédente : applique-les et cite-les.
6. Écris :
   - `docs/sprint.md` : objectif du sprint en une phrase, tableau `id | titre | dépend de | fichiers | critères (ids)`, risques ;
   - `docs/sprint-status.yaml` : `loop.current_epic`, `loop.current_sprint`, les stories en `ready` (schéma du fichier), l'epic en `in_progress` ;
   - `node scripts/validate-status.mjs` doit être vert.
