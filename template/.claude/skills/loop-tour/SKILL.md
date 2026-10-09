---
name: loop-tour
description: Execute UN tour de la boucle de developpement autonome (observe, decide, agit, verifie, enregistre) selon docs/orchestrate.md. A utiliser par l'orchestrateur a chaque lancement du runner, ou quand l'humain dit "fais un tour", "avance la boucle", "lance un tour".
---
# Un tour de boucle

Tu ne sais rien du passé tant que tu ne l'as pas relu. Suis ces étapes dans l'ordre et coche-les avec TodoWrite.

## 0. Charger (sans rien modifier)
1. Lis `docs/orchestrate.md` en entier. C'est la loi ; ce skill n'en est que la check-list.
2. Lis `CLAUDE.md`, `docs/sprint-status.yaml`, `docs/sprint.md`, le dernier `docs/journal/tour-*.md` et les 3 derniers ADR.
3. `node scripts/validate-status.mjs`. S'il est invalide, la première tâche est de réparer l'état : rien d'autre avant.
4. Numéro du tour : variable d'environnement `LOOP_TOUR` (`echo $LOOP_TOUR`). En interactif, prends `loop.tour + 1`.

## 1. Conditions d'arrêt (orchestrate.md § 4.0)
STOP, epics finies, budget, 3 tours sans progrès : applique l'action prévue, écris le journal, termine.

## 2. Observe et réconcilie
- `gh pr list --state all --search "head:story/" --json number,headRefName,state,mergedAt,baseRefName,statusCheckRollup --limit 50`
- Aligne chaque story sur la réalité GitHub : une PR mergée vaut `merged`, une PR fermée vaut `ready`, une CI rouge vaut `changes_requested`.
- Verrous expirés : orchestrate.md § 3.
- Skills disponibles : ceux listés dans ton contexte, plus `ls .claude/skills ~/.claude/skills 2>/dev/null`. Retiens ceux de la table de routage de `CLAUDE.md` qui servent ce tour.

## 3. Décide (orchestrate.md § 4.2)
Écris dans ta todo la liste exacte : stories à lancer (avec leurs fichiers), PR à vérifier, PR à merger.
Vérifie qu'aucun fichier n'est commun à deux stories lancées en parallèle.

## 4. Agit
1. Pose les verrous dans `sprint-status.yaml` (et `started` s'il est vide), valide, puis lance **dans un seul message** un subagent `developer` par story :
   > Story <id> : <titre>. Critères : <liste>. Fichiers possédés : <liste>. Dépendances déjà mergées : <liste>.
   > Suis le skill dev-story. Worktree : .worktrees/<id>, branche story/<id> depuis origin/main.
2. À leur retour, reporte le numéro de PR et passe la story en `review`, ou en `blocked` avec la raison donnée.

## 5. Vérifie (orchestrate.md § 4.4)
Pour chaque PR en `review`, lance en parallèle : CI (`gh pr checks <n> --watch --fail-fast`), `code-reviewer`, `security-reviewer`,
et `qa` si l'interface est touchée. En cas de CHANGES, relance le même `developer` sur la même branche avec la liste exacte des points.
Quand tout est vert et que `policy.merge` vaut `auto` : `release-manager` merge. Après le merge : verrou retiré, story `merged`.

## 6. Fin de sprint
Toutes les stories du sprint sont `merged` : skill `retro`, puis skill `plan-sprint` pour le sprint suivant (ou epic suivante).

## 7. Enregistre
- `sprint-status.yaml` : statuts, `loop.tour`, `no_progress_streak`, `updated`. Puis `node scripts/validate-status.mjs`.
- `docs/journal/tour-<n>.md`, avec le gabarit d'orchestrate.md § 5.
- Ne commite pas : le runner commite `docs/` et pousse `loop/control`. En interactif, commite toi-même sur `loop/control`.
- Dernière réponse : 5 lignes maximum (fait, en cours, bloqué, prochain tour).
