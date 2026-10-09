---
name: dev-story
description: Realise UNE story de bout en bout - worktree story/<id> depuis origin/main, TDD (rouge, vert, refactor), verify, commit, push, PR avec plan de test - puis corrige apres review sur la meme branche. A utiliser par l'agent developer, ou quand l'humain dit "implemente la story X".
---
# Une story, de bout en bout

## 1. Préparer
```
git fetch origin
git worktree add .worktrees/<id> -b story/<id> origin/main      # si la branche existe : git worktree add .worktrees/<id> story/<id>
cd .worktrees/<id> && npm ci
```
Travaille **uniquement** dans `.worktrees/<id>`, avec des chemins absolus ou `cd` en début de commande.
Lis les critères d'acceptation dans `docs/epics.md` (sur `loop/control`, à la racine du projet) et la section de
`docs/system-design.md` qui concerne tes fichiers. Si la story touche l'interface, lis l'écran correspondant de `docs/design-mockup.html`.
Avant d'écrire une fonction utilitaire, cherche si elle existe déjà (`grep`) : réutilise plutôt que de dupliquer.

## 2. TDD
Pour chaque critère :
1. **Rouge** : un test qui échoue pour la bonne raison (`npx vitest run <fichier>`).
2. **Vert** : le code minimal qui le fait passer.
3. **Refactor** : nommage, duplication, fonctions de moins de 40 lignes, fichiers de moins de 300 lignes.
Un test utile prouve une règle métier, une borne, un chemin d'erreur ou un bug corrigé. Ne teste pas le framework,
les getters, les mocks eux-mêmes, et pas de snapshot sans assertion.
Validation des entrées aux frontières (schéma zod), erreurs explicites, aucun secret dans le code (variables d'env, `.env.example`).

## 3. Vérifier
`npm run verify` (lint + typecheck + tests + build) doit être vert. Sinon, corrige ; ne désactive jamais un test ni une règle de lint.

## 4. Livrer
```
git add <fichiers> && git commit -m "feat(<id>): <titre>"          # commits conventionnels
git push -u origin story/<id>
gh pr create --base main --title "<id>: <titre>" --body "<voir gabarit>"
```
Gabarit du corps de PR : **Story** (id, lien vers les critères), **Changements** (3 à 6 puces), **Tests** (ce que chaque
test prouve), **Plan de test** (cases à cocher par critère), **Décisions proposées** (ou « aucune »).

## 5. Après review (CHANGES)
Même worktree, même branche. Corrige chaque point listé et ajoute un test de régression pour chaque bug. Puis `npm run verify`,
commit `fix(<id>): <point>` et push. Si la branche est en retard sur main : `git rebase origin/main` puis `git push --force-with-lease`.

## 6. Rendre compte
Le bloc de sortie défini dans `.claude/agents/developer.md`, rien d'autre.
Bloqué (fichier hors périmètre, dépendance absente, critère ambigu) : arrête-toi et rends `statut: blocked` avec la raison exacte. Ne contourne pas.
