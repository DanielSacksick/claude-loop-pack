---
name: status-report
description: Etat de la boucle lisible par un humain en 30 secondes (position, avance, blocages, couts mesures, prochaine etape), ecrit dans docs/STATUS.md et affiche. A utiliser a la fin de chaque sprint, sur demande ("ou en est-on", "status", "rapport"), ou en observation avec /loop 10m /status-report.
---
# Rapport d'état

Sources : `node scripts/validate-status.mjs`, `node scripts/cost-report.mjs`, `docs/sprint.md`, le dernier journal,
`gh pr list --state open --search "head:story/"`, `.loop/heartbeat.json` (s'il existe).

Écris `docs/STATUS.md` (vue générée, écrasée à chaque fois) puis affiche-la :
```
# État — <date UTC>
**<running|blocked|done>** · epic <id> (<x>/<y> epics) · sprint <n> · tour <t> · dernier tour il y a <m> min
Avancement sprint : ███████░░░ 7/10 stories mergées
Blocages : <aucun | 1 ligne par blocage, avec ce qu'il faut à l'humain>
Coût mesuré : <x> $ / <budget> $ · <y> $ par story mergée · tour moyen <z> min
PR ouvertes : #12 S2-03 (review), #13 S2-04 (CI)
Prochaine étape : <1 ligne>
```
Aucun chiffre qui ne vient pas d'une commande ci-dessus. En fin de sprint, mets aussi à jour `MAP.md` si un module est apparu.
