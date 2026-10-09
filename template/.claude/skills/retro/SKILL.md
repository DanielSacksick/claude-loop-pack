---
name: retro
description: Retrospective de fin de sprint - mesures (stories, retouches, couts, durees du registre), ce qui a marche, ce qui a coince, 3 lecons actionnables - ecrite dans docs/retro/sprint-<n>.md, puis archivage du sprint. A utiliser a chaque fin de sprint, ou quand l'humain dit "retro".
---
# Rétrospective de sprint

1. **Mesures**, uniquement à partir des données : `node scripts/cost-report.mjs --json`, les stories du sprint (statuts, `attempts`),
   les journaux des tours du sprint, et les commentaires `LOOP-REVIEW` des PR (`gh pr view <n> --json comments`).
   - stories livrées / prévues ; retouches (somme des `attempts`) ; PR validées du premier coup ;
   - findings par sévérité et par rôle ; coût et durée du sprint (tours concernés) ; coût par story mergée.
2. **Analyse** : ce qui a marché (à garder), ce qui a coincé (cause racine, pas le symptôme).
3. **3 leçons actionnables maximum**, chacune avec son effet attendu et l'endroit où elle s'applique
   (ex. « découper plus fin les stories qui touchent l'auth → plan-sprint »). Ce qui change le protocole devient un ADR.
4. Écris `docs/retro/sprint-<n>.md` (60 lignes maximum).
5. **Archive** : copie les stories du sprint dans `docs/archive/sprint-<n>.yaml` (clé `stories:`), puis retire-les de
   `docs/sprint-status.yaml`. Marque l'epic `done` si tous ses critères sont livrés. Valide l'état.
