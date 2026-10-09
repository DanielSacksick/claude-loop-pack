# Commandes dans la boucle

La boucle tourne sans humain : une commande hors allowlist est refusée et coûte un tour d'outil.
Ces règles viennent des refus mesurés au banc d'essai du pack.
- Fichiers temporaires : **uniquement** dans `.loop/tmp/` (ignoré par git), jamais dans `/tmp` ni hors du projet.
- Dans un worktree : `git -C .worktrees/<id> …` et `npm --prefix .worktrees/<id> run …` plutôt que `cd X && …`.
- Message de commit long : écris-le avec l'outil Write dans `.loop/tmp/commit-<id>.txt`, puis `git commit -F` ; pas de `$(…)`.
- Attendre la CI : `gh pr checks <n> --watch --fail-fast`, jamais de boucle `for`/`until`/`sleep`.
- Pas de préfixe de variable (`FOO=bar cmd`) : les valeurs locales vont dans `.env` (ignoré), lu par l'app.
- Pas de `node -e`, de `bash -c`, ni de `find /` : écris un script dans `scripts/` ou un test.
