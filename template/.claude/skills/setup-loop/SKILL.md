---
name: setup-loop
description: Cadre un projet AVANT de lancer la boucle autonome - entretien produit, PRD, system-design, maquette HTML validee, epics, sprint 1, etat initial, CLAUDE.md et MAP.md, repo GitHub protege avec CI, puis readiness gate 100 % verte et commande de lancement. A utiliser quand l'humain dit "setup-loop", "cadre mon projet", "prepare la boucle", ou installe le pack sur un nouveau projet.
---
# Cadrer le projet avant la boucle

Sans cadre, la boucle construit une app, mais pas **celle que l'humain a en tête**. Ce skill fixe l'intention sur disque.
Il est **interactif**, à faire avec l'humain présent. Chaque étape produit un fichier ; ✋ = validation humaine explicite
(« oui, validé ») avant de passer à l'étape suivante. Suis l'avancement avec TodoWrite (une tâche par étape).

Reprise : si des livrables existent déjà, relis-les, annonce l'étape où l'on reprend, puis continue de là.

## 1. Entretien produit (`docs/interview.md`)
Une question à la fois, courte, avec un exemple de réponse. Tu reformules chaque réponse en une ligne avant de passer à la suivante.
1. Pour qui ? (utilisateur cible, contexte d'usage)
2. Quel problème, et comment le règle-t-il aujourd'hui ?
3. Les 3 parcours clés, du point de vue de l'utilisateur (« je… pour… »)
4. Ce qui est **hors périmètre** pour cette version
5. Contraintes : stack imposée, hébergement, budget de la boucle (en $), délai, données sensibles
6. À quoi verra-t-on que c'est réussi ? (objectifs mesurables)
Écris les réponses brutes dans `docs/interview.md`.

## 2. PRD (`docs/PRD.md`)
Délègue à l'agent `product-owner`, avec `docs/interview.md`. Gabarit déjà présent dans `docs/PRD.md`.
Il faut : objectifs mesurables, parcours, exigences fonctionnelles numérotées `EF-xx`, non fonctionnelles `ENF-xx`, hors périmètre.
✋ Montre un résumé de 10 lignes et demande la validation. Une fois validé, écris `Statut : validé (AAAA-MM-JJ)` en tête du PRD.

## 3. Conception système (`docs/system-design.md`)
Délègue à l'agent `architect`. Stack par défaut si l'humain n'a pas de préférence : Next.js + SQLite/Drizzle + Vitest
(aucun service externe, CI autonome). Modèle de données, modules (un dossier par feature), intégrations, stratégie de tests, sécurité.
Pas de validation bloquante, mais montre les 5 choix structurants et accepte les corrections.

## 4. Maquette (`docs/design-mockup.html`)
Délègue à l'agent `ui-designer` (qui utilise les skills de design disponibles). Un seul fichier HTML autonome, écrans des
3 parcours, cliquable d'un écran à l'autre, états vides et erreurs, jetons de design dans `:root`.
Ouvre-la pour l'humain (`open docs/design-mockup.html` sur macOS, sinon donne le chemin).
✋ **Validation obligatoire : la boucle codera CETTE interface.** Itère jusqu'au « validé », puis ajoute
`<meta name="loop-validated" content="AAAA-MM-JJ">` dans le `<head>`.

## 5. Epics puis sprint 1 (`docs/epics.md`, `docs/sprint.md`)
1. `product-owner` : epics ordonnées par valeur et par dépendance. Chaque epic a des critères d'acceptation Given / When / Then
   reliés aux `EF-xx`. Chaque `EF` est couvert.
2. Skill `plan-sprint` pour le sprint 1 : stories « un agent, une branche, une PR », fondation en premier, fichiers possédés
   sans chevauchement (validé par `architect`).

## 6. État, carte, repo
1. `docs/sprint-status.yaml` : `project`, `updated`, budget (réponse 5), epics et stories du sprint 1. `loop.status` reste `setup`.
   Puis `node scripts/validate-status.mjs`.
2. `CLAUDE.md` et `MAP.md` : remplace chaque `{{…}}` par les informations de CE projet (stack, commandes, modules prévus).
3. CI : `.github/workflows/ci.yml` est fourni (job `verify` : lint, typecheck, tests ; vert sur un projet encore vide).
4. ✋ Repo GitHub : demande le nom `owner/repo`, s'il faut le créer, et s'il est privé. Puis donne à l'humain la commande à lancer
   **lui-même** (elle commite sur `main`, ce que les hooks t'interdisent) :
   `node scripts/bootstrap-repo.mjs --repo owner/repo [--create]`
5. ✋ Relance programmée, toujours lancée par l'humain : `node scripts/install-schedule.mjs` (launchd sur macOS, crontab sur Linux).
   Rappelle-lui : machine allumée, mise en veille désactivée pendant la boucle (voir INSTALL.md).

## 7. Readiness gate
`node scripts/readiness.mjs` : chaque ligne doit être ✅. La protection serveur de `main` est facultative sur un repo privé
avec un plan gratuit : signale-le comme risque, ce n'est pas bloquant. Corrige chaque ❌ ; relance la commande jusqu'au vert.
✋ Montre le tableau et demande le feu vert final. Puis affiche exactement :
```
Tout est prêt. Pour lancer la boucle :
  node scripts/loop-start.mjs
Pour suivre : node scripts/cost-report.mjs · cat docs/STATUS.md · /loop 10m /status-report
Pour arrêter : touch STOP
```
Ne lance pas la boucle toi-même : c'est l'humain qui appuie sur le bouton.
