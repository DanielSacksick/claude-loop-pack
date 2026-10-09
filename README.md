# Le pack /loop

**Claude développe ton app en autonomie, tour après tour, sans que tu interviennes, à condition de lui donner un cadre.**
Ce pack, c'est ce cadre : des fichiers à la racine du projet, une équipe d'agents, des skills, des garde-fous,
et une boucle qui se relance toute seule, même quand tu as fermé Claude Code.

## Ce que tu obtiens
| Brique | Rôle |
|---|---|
| `/setup-loop` | Cadrage guidé : entretien, PRD, conception, **maquette HTML cliquable que tu valides**, epics, sprint 1, repo GitHub, readiness gate |
| Boucle de tours | Chaque tour relit tout depuis le disque, lance plusieurs développeurs en parallèle (un worktree et une branche par story), fait relire chaque PR (code + sécurité + QA), merge ce qui est vert, enregistre, et s'arrête |
| Relance | launchd (macOS) ou cron (Linux) : tour suivant 30 min après la fin du précédent, heartbeat, chien de garde qui relance si rien ne bouge depuis 2 h |
| 9 agents | orchestrateur, product owner, architecte, designer UI, développeur, QA, relecteur de code, relecteur sécurité, release manager. Chacun a son modèle et ses outils au plus juste |
| 8 skills | `setup-loop`, `loop-tour`, `plan-sprint`, `dev-story`, `review-pr`, `security-check`, `retro`, `status-report`, plus une table de routage qui utilise aussi **les skills que tu as déjà installés** |
| Garde-fous | hooks testés : aucun commit ni push sur `main`, aucun secret dans un diff, aucune commande destructrice, budget global ; permissions en allowlist, jamais de contournement |
| Mesure | chaque tour inscrit son coût réel ($ et tokens), sa durée et son issue ; `cost-report` en tire le coût par story et une projection |

## Pourquoi ça tient la distance
- **Zéro mémoire en contexte.** L'état vit dans `docs/sprint-status.yaml`, versionné sur une branche `loop/control` poussée à chaque tour.
  Un tour peut planter, la machine redémarrer : le suivant reprend exactement là où on en était.
- **Un tour = un process `claude -p`**, avec un plafond de dépense natif (`--max-budget-usd`). Pas de session géante qui dérive.
- **Pas de devinette.** Il manque une décision produit ? La boucle passe en `blocked`, dit exactement ce qu'il te faut, et te notifie.
- **Arrêts explicites** : toutes les epics livrées, budget épuisé, fichier `STOP`, ou 3 tours sans progrès (avec rapport d'escalade).

## Installation
→ [INSTALL.md](INSTALL.md). En résumé : `node install.mjs ../mon-projet`, puis `/setup-loop` dans Claude Code, puis `node scripts/loop-start.mjs`.

## Ce que dit le banc d'essai
Le pack est éprouvé sur un projet témoin (app de tâches d'équipe : auth, CRUD, tableau de bord) : relance depuis une session fermée,
reviews réellement exécutées, coût mesuré à chaque tour. Le rapport chiffré complet sera publié ici.

## FAQ
**C'est `/loop` de Claude Code ?** Non. `/loop` s'arrête quand tu fermes la session et expire au bout de 7 jours
([doc](https://code.claude.com/docs/en/scheduled-tasks)). Le pack utilise un planificateur système et `claude -p` :
ça survit à la fermeture de la session, et ça tourne aussi longtemps que ta machine reste allumée.
`/loop` reste pratique pour *regarder* la boucle : `/loop 10m /status-report`.

**Et `/schedule` (routines cloud) ?** Cadence minimale d'une heure, push limité aux branches `claude/*`, pas d'état local.
Voir [docs/ADR/002](docs/ADR/002-relance-launchd-claude-p.md).

**Ça merge tout seul ?** Par défaut oui : squash merge quand la CI est verte **et** que les relectures code et sécurité
sont positives. Passe `policy.merge: manual` pour garder la main.

**Combien ça coûte ?** Ça dépend de la taille de l'app et du nombre de tours. Le budget est un plafond dur que tu fixes.
Les chiffres mesurés sont dans le rapport du banc. Tes plugins globaux alourdissent chaque appel : `LOOP_LEAN=1` les
désactive pour la boucle (le banc mesure le gain).

**Je peux coder en même temps ?** Oui, dans un worktree à toi ou sur une branche à toi. Le dossier du projet reste sur
`loop/control` (l'état de la boucle) ; évite d'y modifier des fichiers pendant un tour.

## Limites honnêtes
- La boucle tourne **sur ta machine** : machine en veille = boucle en pause (elle reprend toute seule au réveil).
- Elle ne remplace pas ton jugement produit : sans cadrage validé, elle refuse de démarrer.
- Elle ne fait pas de déploiement en production, ne gère ni secrets ni comptes tiers : ces décisions te reviennent.
- La protection serveur de `main` demande un repo public ou un plan GitHub payant ; sinon seuls les hooks locaux protègent `main`.
- Le premier lancement d'un dossier exige d'accepter une fois la confiance du dossier dans Claude Code (sinon l'allowlist est ignorée) ;
  la readiness gate le vérifie.
