# Installation (5 minutes)

## Prérequis
| Outil | Pourquoi | Vérifier |
|---|---|---|
| Claude Code ≥ 2.1.221, connecté (plan Pro/Max ou clé API) | la boucle, c'est `claude -p` | `claude --version` |
| Node.js ≥ 20 | hooks et scripts (aucune dépendance npm) | `node -v` |
| git | branches, worktrees | `git --version` |
| GitHub CLI, connecté | PR, CI, merges | `gh auth status` |
| macOS (launchd) ou Linux (cron) | relance programmée | — |

Coût : la boucle consomme des tokens. Fixez un budget au cadrage ; il est appliqué (plafond par tour et plafond global).
Ordre de grandeur mesuré au banc : 6 à 7,5 $ par tour, environ 3,7 $ par story mergée (sur une petite app).

## 1. Copier le pack dans votre projet
```bash
node /chemin/vers/loop-pack/install.mjs /chemin/vers/mon-projet
```
- Projet neuf ou existant. Rien n'est écrasé : un fichier déjà présent est conservé et listé.
- Si vous avez déjà un `.claude/settings.json`, la version du pack est écrite dans `.claude/settings.loop.json` :
  fusionnez-y à la main les `permissions` et les `hooks`.
- Un bloc est ajouté au `.gitignore` (`.loop/`, `.worktrees/`, `.env*`, `STOP`).

## 2. Cadrer (30 à 60 minutes, avec vous)
Ouvrez le projet dans Claude Code et tapez :
```
/setup-loop
```
Entretien → PRD ✋ → conception → maquette ✋ → epics et sprint 1 → repo GitHub ✋ → relance ✋ → readiness gate ✋.
Le skill vous donne deux commandes à lancer **vous-même**, parce qu'elles touchent `main` et votre système :
```bash
node scripts/bootstrap-repo.mjs --repo moi/mon-projet --create
node scripts/install-schedule.mjs
```

## 3. Lancer
```bash
node scripts/readiness.mjs
node scripts/loop-start.mjs
```
Ensuite, rien à faire. Un tour démarre, puis un autre 30 minutes après la fin du précédent, et ainsi de suite.

## Pendant la boucle
| Besoin | Commande |
|---|---|
| État en 30 secondes | `cat docs/STATUS.md` ou `/status-report` |
| Coûts mesurés | `node scripts/cost-report.mjs` |
| Ce qu'a fait le dernier tour | `ls docs/journal/` puis le dernier fichier |
| Pause propre | `touch STOP` (le tour en cours finit son étape) |
| Reprise | `node scripts/loop-start.mjs` |
| Désinstaller la relance | `node scripts/install-schedule.mjs --uninstall` |

## Garder la machine éveillée (macOS)
La relance tourne sur votre machine : si elle dort, la boucle dort, puis reprend toute seule au réveil.
Pour 72 h d'affilée : branchez le Mac et lancez `caffeinate -dimsu -t 259200` dans un terminal, ou désactivez la veille
dans Réglages › Énergie.

## Réglages (facultatif)
`.loop/env` (non versionné), une variable par ligne :
```
LOOP_INTERVAL_MIN=30          # pause entre deux tours
LOOP_TOUR_TIMEOUT_MIN=90      # au-delà, le tour est tué
LOOP_WATCHDOG_STALE_MIN=120   # heartbeat plus vieux = relance par le chien de garde
LOOP_ORCHESTRATOR_MODEL=      # vide = modèle de .claude/agents/orchestrator.md
LOOP_NOTIFY_CMD=              # script qui reçoit chaque alerte (Telegram, Slack…)
```
La politique de la boucle (parallélisme, merge auto ou manuel, reviews requises) se règle dans
`docs/sprint-status.yaml` › `policy` ; le budget dans `budget`.
