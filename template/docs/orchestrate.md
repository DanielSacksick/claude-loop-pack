# Protocole de boucle

Lu **en entier au début de chaque tour** par l'orchestrateur. C'est la loi de la boucle : si un autre document
le contredit, ce fichier gagne. On le modifie seulement par PR, avec un ADR.

## 1. Principes
1. **Zéro mémoire en contexte.** Tout ce qui compte est sur disque ou sur GitHub. Un tour commence sans rien savoir.
2. **Un tour = un process** `claude -p --agent orchestrator`, lancé par `scripts/loop-runner.mjs`. Le runner mesure
   le coût, l'inscrit dans le registre et programme le tour suivant. **L'orchestrateur ne se relance jamais lui-même.**
3. **Ne jamais deviner.** S'il manque une information produit, un secret ou une décision humaine : `blocked` avec
   un `blocked_reason` qui dit exactement quoi fournir, puis on arrête le tour.
4. **Jamais de commit sur `main`.** On passe toujours par une PR depuis `story/<id>`. Les hooks et la protection de branche GitHub l'imposent.
5. **Rien d'inventé.** Les coûts et les durées viennent du registre (`tours`) ; les statuts sont réconciliés avec GitHub.

## 2. Topologie git
```
<projet>/                 checkout principal, TOUJOURS sur loop/control (état, plans, journal, ADR)
<projet>/.worktrees/<id>  un worktree par story, branche story/<id> tirée d'origin/main
origin/main               le code livré, modifié uniquement par des PR squash-mergées
origin/loop/control       l'état de la boucle, poussé par le runner à chaque tour
```
- Au début de chaque tour, le runner merge `origin/main` dans `loop/control`.
- Les stories partent **toujours** d'`origin/main`. **Pas de PR empilées** : une story qui dépend d'une autre attend que celle-ci soit mergée.
- Seul l'orchestrateur écrit sur `loop/control` : `docs/sprint-status.yaml`, `docs/sprint.md`, `docs/journal/`, `docs/ADR/`, `docs/retro/`, `MAP.md`.
  Les développeurs ne touchent ni ces fichiers ni les ADR. Ils proposent une décision dans la description de leur PR.

## 3. État : `docs/sprint-status.yaml`
Schéma commenté dans le fichier lui-même. Il est validé par `node scripts/validate-status.mjs` **au début et à la fin** de chaque tour ;
un état invalide se corrige avant toute autre action.

Cycle de vie d'une story :
```
ready ──(verrou + worktree)──> in_progress ──(PR ouverte)──> review ──(CI + reviews vertes)──> merged
                                    ^                          │
                                    └── changes_requested <────┘   (attempts + 1 ; si attempts > max → blocked)
```
- **Verrou** : `lock: {by, since, branch}` posé au lancement du développeur, retiré à `merged` ou `blocked`.
  Un verrou plus vieux que `policy.lock_ttl_minutes` est **expiré**. S'il existe une PR, la story passe en `review` ;
  sinon elle repasse en `ready`, le worktree est supprimé et la branche est conservée pour analyse.
- Deux stories verrouillées ne peuvent pas posséder de fichiers qui se chevauchent : le validateur le refuse.
- `updated` à la racine et dans chaque story : horodatage ISO 8601 UTC de la dernière modification.
- La section `tours` appartient au runner. On n'y écrit jamais.

## 4. Un tour
### 0. Conditions d'arrêt (vérifiées en premier)
| Condition | Action |
|---|---|
| fichier `STOP` à la racine | journal, fin du tour, sans rien lancer |
| toutes les epics `done` | `loop.status: done`, rapport final (skill `status-report`), PR `loop/control → main` des docs |
| budget restant < `budget.per_tour_usd` / 2 | `blocked`, raison « budget » |
| `loop.no_progress_streak >= 3` | `blocked`, écrire `docs/ESCALATION.md` (voir § 6) |

### 1. Observe
Lire dans cet ordre : ce fichier, `CLAUDE.md`, `docs/sprint-status.yaml`, `docs/sprint.md`, le dernier
`docs/journal/tour-*.md`, puis les 3 derniers ADR. Ensuite :
- `node scripts/validate-status.mjs`
- `gh pr list --state all --search "head:story/" --json number,headRefName,state,mergedAt,baseRefName,reviewDecision,statusCheckRollup --limit 50`
- **Réconcilier** : une PR mergée vaut `merged`, une PR fermée sans merge vaut `ready` (attempts + 1), une CI rouge vaut `changes_requested`.
- Lister les skills disponibles (ceux de `.claude/skills/` et ceux de l'utilisateur) et noter ceux qui servent ce tour (table de routage de `CLAUDE.md`).

### 2. Décide
- Prêtes = `ready` et dont toutes les `depends_on` sont `merged`.
- Développeurs ce tour = min(`policy.max_parallel_devs`, prêtes sans chevauchement de `files`, budget restant ÷ coût moyen d'une story).
- Priorité aux stories `changes_requested` (finir avant de commencer), puis à celles qui débloquent le plus de dépendances.
- Si aucune story n'est prête mais que le sprint n'est pas fini : ce qui bloque est-il dans nos mains ? Si oui, on le traite. Sinon, `blocked`.
- Sprint terminé (toutes les stories `merged`) : skill `retro`, puis skill `plan-sprint` pour le sprint suivant ; on enchaîne dans le même tour si le budget le permet.

### 3. Agit
Pour chaque story retenue, **dans un seul message** (lancement parallèle) : un subagent `developer`
avec le skill `dev-story`, en lui passant l'id de la story, ses critères d'acceptation et ses fichiers.
Avant le lancement : poser le verrou, `status: in_progress`, `branch: story/<id>`, `started` (s'il est vide), valider l'état.
Le développeur rend : numéro de PR, résumé, tests ajoutés, décisions proposées. Il ne merge jamais.

### 4. Vérifie (par PR, en parallèle)
1. CI : `gh pr checks <n> --watch --fail-fast`.
2. `code-reviewer` (skill `review-pr`) et `security-reviewer` (skill `security-check`), en parallèle.
3. `qa` : critères d'acceptation, comparaison avec `docs/design-mockup.html` pour l'UI.
4. Chaque verdict est publié en commentaire de PR avec une ligne-marqueur `LOOP-REVIEW <rôle>: APPROVE|CHANGES`.
   On ne peut pas approuver sa propre PR sur GitHub, d'où les commentaires.
5. Un problème trouvé ? Le **même** développeur corrige (même branche), on repasse en 1. Au-delà de `policy.max_attempts`, la story passe en `blocked`.
6. Tout est vert ? Merge selon `policy.merge` :
   - `auto` (défaut) : `release-manager` vérifie que la base est `main` et que la branche est à jour (sinon rebase sur `origin/main`,
     `push --force-with-lease`, retour en 1), puis `gh pr merge <n> --squash --delete-branch`.
   - `manual` : la story reste en `review` avec la mention « prête à merger » dans le journal. L'humain merge, le tour suivant réconcilie.
7. Après le merge : retirer le verrou, `git worktree remove .worktrees/<id>`, `status: merged`.

### 5. Enregistre
- `docs/sprint-status.yaml` : statuts, verrous, `loop.tour` = numéro du tour (variable `LOOP_TOUR`), `no_progress_streak`
  (remis à 0 si au moins une story est passée à `merged` ou à `review`, +1 sinon), `updated`.
- `docs/journal/tour-<n>.md` : gabarit en § 5. C'est le seul récit, l'état n'en contient pas.
- Décision durable : un ADR `docs/ADR/NNN-titre.md`, numéroté après le plus grand existant sur `loop/control`.
- `MAP.md` mis à jour si un module est apparu (skill `status-report` en fin de sprint).
- `node scripts/validate-status.mjs`, puis fin du tour. **Ne pas** programmer de relance : c'est le travail du runner.

## 5. Gabarit du journal (`docs/journal/tour-<n>.md`, 40 lignes max)
```
# Tour <n> — <date UTC>
Position : epic <id>, sprint <n> | statut boucle : <status>
Skills utilisés : <liste>
## Fait
- S1-02 mergée (#14), 2 tours de review, 1 HIGH corrigé (+ test de régression)
## En cours / bloqué
- S1-04 changes_requested : <raison courte>
## Décisions
- <décision> (ADR NNN si durable)
## Prochain tour
- <ce que le prochain tour doit faire en premier>
```

## 6. Escalade (`docs/ESCALATION.md`, réécrit, jamais allongé)
Dans quel cas : 3 tours sans progrès, état irréparable, budget épuisé, conflit qu'on ne sait pas résoudre.
Contenu : ce qui a été tenté (avec les liens vers les tours), l'hypothèse sur la cause, **2 ou 3 options**
avec une recommandation, et la commande exacte pour relancer une fois la décision prise (en général :
corriger, passer `loop.status: running`, supprimer `STOP`).

## 7. Politique (modifiable dans `sprint-status.yaml` › `policy`)
| Clé | Défaut | Effet |
|---|---|---|
| `max_parallel_devs` | 3 | développeurs simultanés par tour |
| `merge` | auto | `auto` : squash merge quand CI + reviews requises vertes ; `manual` : l'humain merge |
| `required_reviews` | 2 | code + sécurité (QA en plus quand il y a de l'UI) |
| `lock_ttl_minutes` | 120 | expiration d'un verrou |
| `max_attempts` | 3 | cycles de correction avant `blocked` |
