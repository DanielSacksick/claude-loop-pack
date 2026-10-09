# Rapport du banc d'essai — pack /loop

Banc du 2026-10-09. Projet témoin : app de tâches d'équipe (auth, CRUD, tableau de bord), Next.js + SQLite/Drizzle + Vitest,
repo GitHub privé, CI GitHub Actions. Tous les chiffres viennent du registre mesuré (`total_cost_usd` et `modelUsage` de
`claude -p`), de l'état, de GitHub et des journaux. Méthode : score global défini avant la première mesure (autonomie, coût, efficacité, reviews, rapidité ; sécurité en porte).

## En une phrase
4 tours sans aucune intervention humaine, dont 3 relancés par launchd alors qu'aucune session Claude Code n'était ouverte.
Au total, 4 stories mergées, toutes du premier coup, relues (code + sécurité, vérifications réellement exécutées),
avec 0 commit sur `main` et 0 secret commité, pour 22,92 $ mesurés. La boucle s'est arrêtée d'elle-même sur budget,
avec un rapport d'escalade.

## Avant / après par axe
« Avant » = configuration de référence (tours 1-2). « Après » = harness itéré (cumul des tours 1-4).

| Axe | Avant (après tour 2) | Après (après tour 4) | Ce qui l'a fait bouger |
|---|---|---|---|
| A — Autonomie | 100 | 100 | 0 intervention ; relances programmées : 1/1 puis 3/3 |
| C — Coût | 23 | 52 | 12,83 $ par story mergée → 5,73 $ (le pipeline se remplit ; les reviews du tour 2 sont soldées au tour 3) |
| E — Efficacité | 33 | 100 | 1 mergée sur 3 lancées → 4 sur 4 |
| Q — Reviews du premier coup | 100 | 100 | 4/4 PR validées sans retouche ; findings 0 C / 0 H / 3 M / 9 L |
| R — Rapidité | 100 | 96 | médiane « story lancée → mergée » de 31 min (28, 35, 36 ; et 6 min pour S1-01, mesurée depuis son premier commit) |
| S — Sécurité (porte) | 1 | 1 | 0 commit direct sur main, 0 secret sur main, 1 secret bloqué à l'écriture, refus de permission justifiés |
| **Global** | **67,5** | **87,5** | **+30 %** |

| Tour | Déclencheur | Config | Durée | Coût | Mergées | Refus de permission |
|---|---|---|---|---|---|---|
| 1 | manuel (`loop-start`) | référence | 21,3 min | 6,94 $ | 1 | 1 |
| 2 | launchd | référence | 16,6 min | 5,89 $ | 0 (2 PR prêtes) | 1 |
| 3 | launchd | itération 1 (lean) | 26,7 min | 7,45 $ | 2 | 32 |
| 4 | launchd | itération 2 (règles de commandes) | 10,0 min | 2,64 $ | 1 | 9 |

Cadrage `setup-loop` (hors boucle, une fois par projet) : **11,05 $, 38 min**, 3 validations humaines + 2 commandes.

## Ce qui a le plus pesé
1. **Les sous-agents font 75 % du coût.** Sonnet (développeur + relecteurs) : 5,20 $, 4,31 $, 5,56 $ et 1,58 $ par tour,
   contre 1 à 1,8 $ pour l'orchestrateur Opus. Le poste principal est la relecture en cache du contexte de travail
   (7 à 10 M de tokens par tour) : code, diffs, tests.
2. **Une review coûte autant qu'un développement.** Avec 2 reviews obligatoires, une story coûte environ 3 fois un développement seul.
   C'est le prix du « 0 HIGH mergé » : les relecteurs ont réellement lancé `vitest`, `eslint`, `tsc`, `npm audit` et
   vérifié des hachages. Ils n'ont pas simplement lu le diff.
3. **L'allowlist globale de la machine masquait celle du pack.** Avec un `Bash(*)` dans `~/.claude/settings.json`, les
   permissions du pack ne servaient à rien (1 refus). Isolé en mode lean, 32 refus. Le mode lean est passé par défaut : c'est la
   seule frontière de permissions reproductible chez l'acheteur.
4. **Les règles de commandes chargées automatiquement** (`.claude/rules/loop-commands.md`) ont fait tomber les refus de
   32 à 9 (−72 %), sans toucher à la sécurité. Les 9 restants sont des refus justes, par exemple une suppression de commentaire
   via `gh api -X DELETE`, ou `node -e`.
5. **Le budget par tour structure le travail.** L'orchestrateur a réduit le parallélisme (2 développeurs au lieu de 3), puis
   appliqué « finir avant de commencer ». Il a préféré reporter des reviews plutôt que les tronquer, et n'a jamais laissé de branche à moitié faite.

## Itérations du harness
| # | Hypothèse | Résultat | Gardé |
|---|---|---|---|
| 0 | Instrumenter avant d'itérer | ligne de sévérités standard, `started`, déclencheur tracé | oui |
| 1 | Le contexte fixe des plugins (64k → 21k tokens) fait le coût | **réfutée** : −6 % de tokens relus seulement. Mais elle a révélé le trou de permissions (point 3) | oui (lean par défaut) |
| 2 | Les refus viennent d'habitudes d'agent | **confirmée** : 32 → 9 refus, tour le plus court et le moins cher | oui |
La règle d'arrêt « deux itérations sous 5 % » n'a pas été atteinte : le commanditaire a limité le banc à quelques tours.
L'itération suivante à tester : relecteurs en Haiku sur les stories sans risque (UI pure, règles pures), Sonnet gardé
pour sécurité et auth. C'est le plus gros levier de coût restant.

## Modèles retenus, justifiés par la mesure
| Rôle | Modèle | Mesure qui le justifie |
|---|---|---|
| Orchestrateur, architecte | Opus | 1 à 1,8 $ par tour (environ 25 %) pour toutes les décisions : partition des fichiers, ADR fondés sur des faits vérifiés, arbitrages budget |
| Développeur, relecteurs, QA, PO, designer | Sonnet | 4/4 PR sans retouche, findings réels (MEDIUM de typage `TeamId` repris en story), CI verte au premier push |
| Release manager | Haiku | 0,06 à 0,13 $ par tour, merges et rebases mécaniques sans erreur |
Modèle par défaut du CLI (Fable) mesuré 1,4 fois plus cher qu'Opus sur un appel à vide : le runner fixe toujours le modèle via l'agent.

## Coût estimé de 72 h pour un projet de cette taille
Mesures : tour moyen 18,7 min et 5,73 $ ; coût par story mergée 5,73 $ (sprint de fondation, le plus coûteux en reviews).
- **L'app témoin entière** (environ 28 stories estimées sur 4 epics) : environ 160 $ et 30 tours. À 30 min de pause entre les tours,
  c'est environ 25 h de boucle. **Pour une app de cette taille, 72 h ne sont pas nécessaires.**
- **72 h pleines** (environ 88 tours à ce rythme, extrapolation) : environ 500 $. Une app 3 fois plus grosse les occupe.
- Plus le cadrage, une fois : environ 11 $.

## Limites honnêtes (ce que la boucle ne sait pas encore faire seule)
- **Elle s'arrête sur budget**, et c'est voulu : relever le plafond reste une décision humaine.
- **Le coût par story est élevé** sur un socle sensible (auth, isolation) à cause des 2 reviews. Il n'est pas encore mesuré sur des stories d'UI.
- **QA visuelle contre la maquette** : non exercée par ce banc (le sprint de fondation n'avait pas d'écran métier).
- **4 tours, 1 projet, 1 machine** : ces chiffres sont des ordres de grandeur, pas une garantie.
- **La protection serveur de `main`** est indisponible sur un repo privé en plan GitHub gratuit. Seuls les hooks ont protégé `main`, et ils ont tenu.
- **Prérequis découverts au banc** : CLI `claude` connecté et dossier approuvé une fois (sinon l'allowlist est ignorée).
  La readiness gate les vérifie désormais.
- La variante « machine éteinte » (GitHub Actions) est documentée mais n'a pas été testée.
