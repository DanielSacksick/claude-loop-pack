# ADR 001 — Faits Claude Code sur lesquels repose le pack

- Statut : accepté
- Date : 2026-10-09
- CLI testée localement : 2.1.221 (certaines fonctions documentées exigent une version plus récente, signalées ci-dessous)

Ce fichier est la seule source des faits « plateforme » du pack. Les autres documents y renvoient.
Revérifier à chaque mise à jour du pack : ces fonctions évoluent vite.

## /loop (tâches planifiées de session)
- Tâche récurrente à intervalle fixe ou auto-cadencée (délai 1 min à 1 h), 50 tâches max par session.
- **Expiration après 7 jours**, et **plus aucun tir si la session ou le terminal est fermé**.
- Conséquence : `/loop` convient pour piloter à la main, pas pour une autonomie qui survit à une fermeture.
- Source : https://code.claude.com/docs/en/scheduled-tasks

## Routines cloud (/schedule)
- Research preview (Pro, Max, Team, Enterprise). Cadence minimale 1 h. Clone du repo à chaque run.
- Push uniquement sur des branches `claude/*`, ouverture de PR possible. Machine éteinte : OK.
- Quotas : 100 runs planifiés/h/compte, 30/h/routine en « Run now » ou API. Une routine qui perd la connexion GitHub est suspendue après 72 h.
- Source : https://code.claude.com/docs/en/routines

## Tâches planifiées de l'app desktop
- Ne tournent que si l'app est ouverte et l'ordinateur éveillé ; un seul rattrapage sur 7 jours.
- Source : https://code.claude.com/docs/en/desktop-scheduled-tasks

## Mode non interactif `claude -p`
- `--output-format json` renvoie `total_cost_usd`, `session_id`, `is_error`, `num_turns`, `usage` (vérifié au banc, voir `docs/BENCH.md`).
- Flags utilisés par le pack : `--max-budget-usd` (plafond par tour, natif), `--max-turns`, `--model`,
  `--permission-mode dontAsk` (tout ce qui n'est pas en allowlist est refusé, sans prompt), `--resume <session_id>`,
  `--append-system-prompt`, `--settings`. Sans hôte interactif, une demande de permission = refus.
- Sources : https://code.claude.com/docs/en/headless , https://code.claude.com/docs/en/cli-reference

## Worktrees
- `claude -w <nom>` crée `<repo>/.claude/worktrees/<nom>` sur la branche `worktree-<nom>`.
- Subagent avec `isolation: worktree` : worktree temporaire, supprimé automatiquement s'il n'y a aucun changement.
- Source : https://code.claude.com/docs/en/worktrees

## Subagents
- `.claude/agents/<nom>.md`, frontmatter : `name`, `description`, `tools`, `model` (`opus`, `sonnet`, `haiku`, `fable`,
  ID complet ou `inherit`), `permissionMode`, `skills`, `isolation`…
- 20 subagents concurrents max, imbrication 3 niveaux par défaut.
- Source : https://code.claude.com/docs/en/sub-agents

## Hooks
- Événements dont `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `SessionStart`, `UserPromptSubmit`.
- Entrée JSON sur stdin ; **exit 2 = blocage**, stderr renvoyé à l'agent ; ou JSON `permissionDecision` (allow/deny/ask/defer).
- `$CLAUDE_PROJECT_DIR` disponible.
- Source : https://code.claude.com/docs/en/hooks

## Skills
- `.claude/skills/<nom>/SKILL.md`, la `description` déclenche le skill (tronquée à 1 536 caractères), < 500 lignes conseillé.
- Source : https://code.claude.com/docs/en/skills

## Permissions (settings.json)
- Évaluation deny > ask > allow. Listes fusionnées entre fichiers ; précédence managed > `--settings` > local > projet > user.
- Syntaxe `Bash(git push *)`. Modes : default, acceptEdits, plan, auto, dontAsk, bypassPermissions.
- Le pack n'utilise **jamais** bypassPermissions : il utilise `dontAsk` + allowlist + hooks.
- Sources : https://code.claude.com/docs/en/permissions , https://code.claude.com/docs/en/permission-modes , https://code.claude.com/docs/en/settings

## Autres pistes écartées pour la boucle
- GitHub Actions `claude-code-action@v1` en `schedule` : viable mais facturé en minutes Actions, sans état local, planifications désactivées après 60 jours d'inactivité sur repo public. https://code.claude.com/docs/en/github-actions
- Agent teams : expérimental, pas en mode `-p`. https://code.claude.com/docs/en/agent-teams

## Fonctions documentées plus récentes que la CLI testée
`--permission-prompts none` (2.1.259+), déclencheur GitHub de `/schedule` (2.1.225+). Le pack ne s'appuie pas dessus.
