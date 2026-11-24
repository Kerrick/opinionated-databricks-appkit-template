# Working on this repository

This repository is a template for `databricks apps init`. The template itself is `generic/`, a fork of AppKit's `template/` folder. Everything else here (this file, `README.md`, `docs/`, `scripts/`, `.github/`) belongs to the template repository and never reaches a generated project.

## Landing changes

- Commit straight to `trunk` in small steps. Each commit must pass the check on its own before it's pushed. Rebase on `origin/trunk`, run the check again if the trunk moved, then push. No long-lived branches and no force-pushes.
- The check is `mise x -- pnpm run check` at the repository root. It generates a project with no plugins and one with every plugin from this checkout, installs each, and runs each project's own `pnpm run check`. It needs no root and no workspace credentials, and no test may reach the real internet.
- After a push, CI runs the same check on Linux (x86-64 and Arm), macOS and Windows. A red trunk is fixed or reverted before anything else.

## Tracking work

- Every piece of work has a GitHub issue before it starts. Commits name it (`Refs #N`), and the commit that finishes it says `Closes #N`.
- Never file issues, pull requests or comments on other projects. Draft them in `docs/upstream/` (one `.md`, plus a `.patch` where a fix is known) for the maintainer to decide on.

## Changing the template

- Keep AppKit's conventions in `generic/`: `.tmpl` files, `{{.projectName}}` and the other variables, and the plugin conditionals.
- Record every change to a file that came from AppKit in `docs/upstream/README.md`, so a later upstream merge keeps it.
- The generated project's documents live in `generic/_docs/`, because `apps init` skips any folder named `docs`. Its agent guides are the `AGENTS.md.tmpl` and `CLAUDE.md.tmpl` files, for the same reason.
- A choice that shapes a generated project gets its reasons in that project's design documents. A decision that would take a layer rewritten to undo gets an ADR in `generic/_docs/decisions/`. Most decisions don't.
- Nothing specific to one team, company or domain goes in the template.

## Maintaining it

How CI, Renovate and the version pins are kept current is in `docs/maintenance.md`. How the fork tracks AppKit is in `docs/upstream/README.md`.
