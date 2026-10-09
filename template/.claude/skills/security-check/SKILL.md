---
name: security-check
description: Revue de securite d'une PR ou du projet - secrets, injections, authn/authz, validation des entrees, XSS/CSRF, dependances, donnees sensibles - chaque vulnerabilite tracee de la source au sink, verdict "LOOP-REVIEW security - APPROVE ou CHANGES". A utiliser par le security-reviewer sur chaque PR, et avant toute release.
---
# Revue de sécurité

1. Diff : `gh pr diff <n>`. Relève les **sources** (entrées utilisateur, params, corps de requête, fichiers, en-têtes, réponses d'API externes)
   et les **sinks** (SQL, rendu HTML, shell, système de fichiers, redirections, appels réseau, logs).
2. Pour chaque couple source → sink : y a-t-il validation (schéma), échappement ou requête paramétrée ? Décris le chemin exact.
3. Check-list :
   - secrets : aucun dans le diff, `.env*` non commité, lecture centralisée des variables d'env ;
   - authn : chaque route ou action non publique vérifie la session côté serveur ;
   - authz : l'utilisateur a-t-il le droit sur **cette** ressource (propriété, rôle, équipe) ? Pas seulement « est connecté » ;
   - entrées validées aux frontières (zod), tailles bornées, types stricts ;
   - XSS : pas de HTML brut non assaini ; CSRF : mutations par actions serveur ou jeton ; cookies `httpOnly`, `secure`, `sameSite` ;
   - mots de passe hachés (argon2/bcrypt), jamais loggés ; limitation de débit sur la connexion ;
   - erreurs qui ne divulguent ni pile ni données ;
   - dépendances ajoutées : `npm audit --omit=dev` sur la branche, paquet connu et maintenu.
4. Conclus chaque candidat **dans la session** : CONFIRMÉ (avec le scénario d'exploitation en 2 lignes) ou ÉCARTÉ (avec la raison).
5. Publie : `gh pr comment <n> --body "LOOP-REVIEW security: APPROVE|CHANGES ..."`. `CHANGES` s'il reste un CRITICAL ou un HIGH confirmé.
   Dernière ligne du commentaire, toujours : `C:<n> H:<n> M:<n> L:<n>`.
6. Rends : `security <n>: APPROVE|CHANGES (C:x H:y M:z L:w)`.
