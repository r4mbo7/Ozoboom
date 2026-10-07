---
name: release
description: Sortir une version d'Ozoboom de bout en bout - monter la version de 0.1 sur dev, ouvrir la pull request de dev vers main avec un bref récapitulatif des nouveautés, lancer /codex-review-recap, corriger les findings valides, puis fusionner dans main une fois la CI verte. À utiliser seulement quand Constantin demande une sortie, ou invoque /release.
---

Sort une version de `dev` vers `main` ([ADR 0008](../../../docs/adr/0008-branche-dev-et-sorties-sur-main.md)), de la montée de version à la fusion. Invoquer ce skill vaut demande de sortie de Constantin, fusion dans `main` comprise, une fois la CI verte et la revue Codex traitée.

Toutes les commandes git qui écrivent se font dans un worktree jetable, jamais dans le checkout principal, que d'autres sessions utilisent.

## 1. Vérifier qu'il y a quelque chose à sortir

```bash
git fetch origin
gh pr list --base main --head dev --state open --json number,url
git log --oneline origin/main..origin/dev
```

- Une pull request `dev` vers `main` déjà ouverte : donner son lien et s'arrêter.
- Aucun commit dans `origin/main..origin/dev` : le dire et s'arrêter.

## 2. Monter la version

La version de `package.json` sur `origin/dev` est celle de la dernière sortie, au format `X.Y.0`. La suivante ajoute 0.1 : `0.3` donne `0.4`, `0.9` donne `1.0`.

```bash
WT=<scratchpad>/wt-release
git worktree add --detach "$WT" origin/dev
cd "$WT"
NEXT=$(node -p 'const [x, y] = require("./package.json").version.split(".").map(Number); y === 9 ? `${x + 1}.0` : `${x}.${y + 1}`')
npm pkg set version="$NEXT.0"
git commit -am "chore: release $NEXT"
git push origin HEAD:dev
```

Ce commit ne touche que `package.json` : pas de tests locaux, la CI de la pull request lance tout. Si le push est refusé parce que `dev` a bougé, `git fetch origin && git rebase origin/dev` puis pousser à nouveau.

## 3. Écrire le récapitulatif

Lire les commits de la sortie, sujets et corps, et les issues qu'ils ferment :

```bash
git log --format='%s%n%b' origin/main..origin/dev
```

- Titre : `Sortie X.Y : <la nouveauté principale, côté joueur>`.
- Corps en français, court, comme les sorties précédentes (`gh pr list --base main --state merged`) : une ligne `Sortie X.Y de \`dev\` vers \`main\`.`, puis une puce par nouveauté que le joueur voit ou entend, avec ses `#N`. Les changements pour contributeurs (tests, outillage, docs) tiennent en une dernière puce, ou disparaissent s'ils sont mineurs.
- Pas de tiret long.

## 4. Ouvrir la pull request

```bash
gh pr create --base main --head dev --title "Sortie X.Y : ..." --body-file <scratchpad>/release-body.md
```

Donner le lien de la pull request. La CI tourne pendant la revue.

## 5. Revue Codex

Depuis le worktree (le dépôt a `dev` pour branche par défaut, d'où la base explicite), invoquer le skill `codex-review-recap` avec `--base origin/main --scope branch`. Suivre ses étapes jusqu'au récapitulatif, mais pas sa question finale : ici, Constantin a déjà décidé de la suite.

- **Valide** : corriger.
- **A discuter** : corriger seulement si c'est un bug qui cassera la sortie (partie injouable, plantage, désynchronisation en ligne, régression visible). Sinon ne pas bloquer, le garder pour le compte rendu.
- **Faux positif** : ignorer.

Corriger dans le worktree, à jour de `origin/dev` : écrire d'abord le test qui échoue, corriger, lancer les tests des fichiers touchés et `pnpm check`, un commit `fix:` par correction, puis `git push origin HEAD:dev`. La pull request suit `dev` et sa CI repart. Jamais de push direct sur `main`.

## 6. Attendre la CI et fusionner

```bash
gh pr checks <N> --watch
```

- CI rouge : lire le log (`gh run view <id> --log-failed`). Un test qui passe relancé seul est une instabilité : `gh run rerun <id> --failed`, et la noter sur #186. Un vrai échec se corrige comme un finding valide.
- CI verte sur le dernier commit de `dev`, et plus aucun finding valide ou bloquant non corrigé : fusionner en avance rapide, ce qui marque la pull request fusionnée et déploie GitHub Pages.

```bash
git fetch origin
git push origin origin/dev:main
gh pr view <N> --json state
```

Si `dev` a reçu un autre commit depuis la CI verte, attendre la CI de ce commit avant de pousser. Si après deux tours de correction la CI ou la revue bloque encore, s'arrêter et rendre compte sans fusionner.

## 7. Compte rendu

Retirer le worktree (`git worktree remove "$WT"`), puis en quelques lignes : la version, le lien de la pull request, fusionnée ou non et pourquoi, les corrections poussées, et les points à discuter laissés de côté, une ligne chacun.
