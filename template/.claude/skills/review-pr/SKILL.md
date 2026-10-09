---
name: review-pr
description: Relit une PR de story (correction, conception, tests, conformite au system-design), verifie chaque finding en tentant de le refuter, puis publie un verdict "LOOP-REVIEW code - APPROVE ou CHANGES" en commentaire. A utiliser par le code-reviewer, ou quand l'humain dit "relis la PR X".
---
# Revue de PR

1. Contexte : `gh pr view <n> --json title,body,headRefName,files` et `gh pr diff <n>`. Critères de la story dans `docs/epics.md`.
2. Passe la revue sur ces axes, dans cet ordre :
   - **Correction** : le code fait-il ce que disent les critères ? Cas limites, erreurs, concurrence, nulls.
   - **Tests** : chaque critère est-il prouvé par un test qui échouerait si le code était faux ? Y a-t-il des tests inutiles ?
   - **Conception** : respect de `docs/system-design.md` (module, couche), duplication (`grep` d'une logique équivalente ailleurs), responsabilité unique, fonctions de moins de 40 lignes.
   - **Périmètre** : fichiers modifiés en dehors de ceux possédés par la story → HIGH.
   - **Lisibilité** : nommage, code mort, commentaires qui expliquent le « pourquoi ».
3. **Vérification adversariale** : pour chaque finding, essaie de prouver qu'il est faux (relis le code appelant, lance le test).
   Ne garde que ceux qui résistent. Sévérités : CRITICAL (perte de données, faille, crash), HIGH (bug probable, critère non tenu),
   MEDIUM (dette réelle), LOW (style).
4. Publie :
```
gh pr comment <n> --body "LOOP-REVIEW code: APPROVE|CHANGES
- [HIGH] src/x.ts:42 — <problème> — <correctif proposé>
..."
```
   Dernière ligne du commentaire, toujours : `C:<n> H:<n> M:<n> L:<n>` (findings retenus, la mesure du banc la lit).
   `CHANGES` seulement s'il reste un CRITICAL ou un HIGH. Les MEDIUM et LOW n'empêchent pas le merge ; ils vont dans la liste et le journal.
5. Rends à l'orchestrateur : `code <n>: APPROVE|CHANGES (C:x H:y M:z L:w)`.
