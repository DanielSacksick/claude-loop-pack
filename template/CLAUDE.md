# {{PROJECT_NAME}} — règles de l'agent

> Projet développé par une boucle autonome. Navigation : [MAP.md](MAP.md). Protocole : [docs/orchestrate.md](docs/orchestrate.md).
> Ce fichier contient des règles, pas de description du projet (celle-ci est dans MAP.md).

## Contrat de reprise
Tu ne te souviens de rien. Avant d'agir : `docs/orchestrate.md`, `docs/sprint-status.yaml`, `docs/sprint.md`, le dernier
`docs/journal/tour-*.md`. Ce qui n'est pas sur disque ou sur GitHub n'existe pas. En partant, tu laisses l'état valide
(`node scripts/validate-status.mjs`) et un journal.

## Interdits (les hooks en bloquent la plupart, les autres relèvent de ta responsabilité)
- Commit, merge ou push sur `main` ; force push hors `story/*` ; `gh pr merge --admin`.
- Secrets dans le code ou dans un commit ; lire ou commiter `.env*` (seul `.env.example` est versionné).
- `rm -rf` hors du projet ; `git reset --hard` sur `main` ; `git clean -x`.
- Modifier des fichiers qui n'appartiennent pas à ta story ; écrire `docs/sprint-status.yaml`, `docs/ADR/` ou `MAP.md`
  si tu n'es pas l'orchestrateur.
- Deviner : une information produit manquante fait passer en `blocked` avec la question exacte.
- Désactiver un test, une règle de lint ou un hook pour « faire passer ».
- Inventer un chiffre de coût ou de durée : ils viennent de `node scripts/cost-report.mjs`.

## Stack et commandes
{{STACK}} — dev : `{{DEV_CMD}}` · vérif complète : `npm run verify` (lint + typecheck + tests + build) · e2e : `{{E2E_CMD}}`

## Commandes
Règles pour rester dans l'allowlist : `.claude/rules/loop-commands.md` (chargé automatiquement).

## Conventions
- Un dossier par feature ; validation des entrées aux frontières (zod) ; erreurs explicites ; fichiers de moins de 300 lignes, fonctions de moins de 40.
- Tests utiles : règles, bornes, erreurs, régressions. Pas de tests du framework ni de snapshots sans assertion.
- Commits conventionnels (`feat(<story>): …`, `fix(<story>): …`). Une story = une branche `story/<id>` = une PR vers `main`.

## Routage des skills (la boucle les utilise PROACTIVEMENT)
Au début de chaque tour, liste les skills disponibles (pack + ceux de l'utilisateur) et applique cette table.
| Situation | Skill |
|---|---|
| Nouveau projet, cadrage absent ou incomplet | `setup-loop` |
| Lancement du runner, « fais un tour » | `loop-tour` |
| Sprint terminé ou absent, epic suivante | `plan-sprint` |
| Développer une story | `dev-story` |
| PR ouverte à relire | `review-pr` |
| PR touchant auth, données, entrées, dépendances ; avant release | `security-check` |
| Fin de sprint | `retro` |
| « Où en est-on ? », fin de sprint | `status-report` |
| UI à créer ou à comparer à la maquette | skill de design installé (`frontend-design`, `ui-ux-pro-max`…) s'il existe |
| Bug ou test qui échoue sans cause évidente | skill de debug installé (`systematic-debugging`…) s'il existe |
| Doc d'une librairie (API, version) | MCP de documentation (`context7`…) s'il est disponible |
| Parcours critique à tester dans un navigateur | skill e2e ou Playwright installé s'il existe |
Un skill de l'utilisateur plus spécifique que celui du pack (même situation) est préféré ; note-le dans le journal du tour.
