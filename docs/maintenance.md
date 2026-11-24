# Maintenance

Exact version pins age quickly, and AppKit changes often. Two pieces keep this
repository from rotting. Neither reaches a generated project.

## The workflow

`.github/workflows/check.yml` runs `pnpm run check` at the repository root. That
check generates a project from the checkout with the Databricks CLI, installs it
from its lockfile and runs the project's own `check` script, with no workspace
credentials: `apps init` gets a fake host and token, and nothing else sees them.

It runs on:

- every push to `trunk` and every pull request,
- a weekly schedule (Monday 05:17 UTC), so rot is found even when nobody pushes,
- `workflow_dispatch`, for a run by hand.

Each run covers Linux, Windows and macOS, because a generated project has to
work on all three. The repository is public, so all three are free; if it ever
goes private, Windows and macOS minutes cost more than Linux, and the matrix is
the place to trim. Node, pnpm and the Databricks CLI come from `mise.toml` via
`jdx/mise-action`, so CI and a local `mise install` use the same versions. Every
action is pinned to a full commit SHA with its version in a comment.

A push to `trunk` never cancels a run in progress. Only a newer push to the same
pull request does.

## Dependency updates

`renovate.json` configures Renovate. It keeps exact pins (`rangeStrategy: pin`)
and covers the root `package.json`, `generic/package.json` with its lockfile,
`mise.toml`, the GitHub Actions digests, and the AppKit packages, which it
updates together in one pull request. It never automerges. A person merges each
pull request after the check is green.

Setup that has to be done in GitHub, because no file in the repository can do it:

1. Install the Renovate GitHub App (https://github.com/apps/renovate) on this
   repository. Without it, `renovate.json` does nothing.
2. Make the workflow required. In Settings, Branches (or Rules, Rulesets), add a
   rule for `trunk` with "Require status checks to pass before merging" and
   choose the check named `Template check`. That job passes only when every
   operating system's leg passed. Turn on "Require branches to be up to date
   before merging" if you want each update tested against the latest trunk.

Never turn on Renovate's automerge without step 2: with no required check,
GitHub merges as soon as a pull request is mergeable, whatever the workflow says.

## Taking AppKit's template changes

Renovate bumps the AppKit packages, but it cannot take changes to AppKit's own
project template. That is a separate, manual process, described in
[upstream.md](upstream.md).
