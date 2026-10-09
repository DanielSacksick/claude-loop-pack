# ADR 002 — Relance de la boucle : planificateur système + `claude -p`

- Statut : accepté
- Date : 2026-10-09
- Faits plateforme : [ADR 001](001-sources-claude-code.md)

## Contexte
La promesse est un développement qui continue sans humain : un tour, 30 minutes de pause, le tour suivant,
même si la fenêtre Claude Code est fermée, même au-delà de la durée de vie d'une session.

## Options comparées

| Critère | `/loop` | Routine cloud `/schedule` | Tâche desktop | GitHub Actions | **launchd/cron + `claude -p`** |
|---|---|---|---|---|---|
| Survit à la fermeture de session | non | oui | non (app ouverte) | oui | **oui** |
| Durée | 7 jours max | illimitée | illimitée | illimitée | **illimitée** |
| « 30 min après la fin du tour » | approximatif | non (min 1 h, cadence fixe) | non | non (cron fixe) | **oui** (porte `next_run_at`) |
| Pousser `story/*` et `loop/control` | oui | non (`claude/*` seulement) | oui | oui | **oui** |
| Worktrees et état local persistants | oui | non (clone à chaque run) | oui | non | **oui** |
| Coût mesurable par tour | non | partiel | non | partiel | **oui** (`total_cost_usd`) |
| Plafond natif par tour | non | non | non | `--max-turns` | **`--max-budget-usd`** |
| Machine éteinte | arrêt | continue | arrêt | continue | arrêt, reprise au réveil |

## Décision
Un runner local (`scripts/loop-runner.mjs`) exécute **un tour = un process `claude -p`** en mode
`--permission-mode dontAsk` : l'allowlist s'applique, tout le reste est refusé, et `bypassPermissions` n'est jamais utilisé.
- `scripts/loop-tick.mjs`, lancé toutes les 5 minutes par launchd (macOS) ou cron (Linux). Il démarre un tour seulement si
  aucun tour ne tourne, qu'il n'y a ni `STOP` ni boucle terminée ou bloquée, et que `now >= next_run_at`.
  `next_run_at` vaut fin du tour précédent + 30 min, donc la pause compte bien **à partir de la fin** du tour.
- `scripts/loop-watchdog.mjs`, lancé toutes les 15 minutes. Si le heartbeat a plus de 2 h alors que la boucle est `running`,
  il tue un tour figé (au-delà du timeout), libère le verrou, journalise, notifie, puis relance.
- Le heartbeat (`.loop/heartbeat.json`) est écrit au début et à la fin de chaque tour.
- `scripts/install-schedule.mjs` installe les deux tâches : plists launchd sur macOS, lignes crontab sur Linux.

## Conséquences
- La machine doit rester allumée et réveillée. `caffeinate` ou les réglages d'énergie sont documentés dans INSTALL.md.
  Au réveil, le tick suivant reprend tout seul.
- Le chemin des binaires (`node`, `claude`, `gh`, `git`) est figé dans le plist à l'installation : il faut réinstaller après un changement de version manager.
- Variante cloud (machine éteinte) : GitHub Actions avec `claude-code-action`, documentée comme option, non testée au banc.
  `/schedule` ne convient pas tant qu'il ne peut pousser que sur `claude/*`.
- `/loop` reste utile pour **observer** une boucle en direct (`/loop 10m /status-report`), pas pour la piloter.
