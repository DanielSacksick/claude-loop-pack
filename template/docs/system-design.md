# Conception système — {{PROJECT_NAME}}

## 1. Stack
| Couche | Choix | Pourquoi |
|---|---|---|
<!-- Défaut sans préférence : Next.js (App Router, TS strict) · SQLite + Drizzle · Vitest · Playwright (2-3 parcours) · ESLint · GitHub Actions -->

## 2. Modules
Un dossier par feature : `src/features/<feature>/{components,actions.ts,queries.ts,schema.ts}`.
| Module | Responsabilité | Dépend de |
|---|---|---|

## 3. Modèle de données
| Entité | Champs clés | Relations | Règles |
|---|---|---|---|

## 4. Intégrations
| Service | Usage | Config (nom de variable d'env) | Mode dégradé en dev |
|---|---|---|---|

## 5. Stratégie de tests
Unitaires (Vitest) sur la logique et les actions ; e2e (Playwright) sur les parcours critiques ; seuil 80 % sur la logique métier.

## 6. Sécurité
Authn (sessions côté serveur), authz par ressource, validation zod aux frontières, secrets en variables d'env, en-têtes HTTP.

## 7. Fichiers partagés (propriété)
Schéma, layout, configuration : possédés par la story fondation de chaque sprint (voir docs/sprint.md).
