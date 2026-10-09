# MAP — {{PROJECT_NAME}}

> {{ONE_LINE_PURPOSE}}

## Stack
{{STACK}}

## Structure
src/            → code applicatif (un dossier par feature, voir docs/system-design.md)
tests/          → tests e2e (les tests unitaires sont à côté du code)
docs/           → cadrage (PRD, design, maquette, epics), état et protocole de la boucle
.claude/        → agents, skills, hooks, permissions
scripts/        → runner, relance, chien de garde, coûts, readiness

## Points d'entrée
- `docs/orchestrate.md` — protocole de la boucle
- `docs/sprint-status.yaml` — état (source de vérité)
- `docs/STATUS.md` — état lisible en 30 s (généré)
{{ENTRY_POINTS}}

## Commandes
dev : `{{DEV_CMD}}` · verify : `npm run verify` · boucle : `node scripts/loop-start.mjs` · stop : `touch STOP`

## Modules
| Module | Rôle | Entrée |
|---|---|---|
{{MODULES}}

## Décisions
→ `docs/ADR/`

<!-- Updated: {{NOW}} | Files: {{N}} -->
