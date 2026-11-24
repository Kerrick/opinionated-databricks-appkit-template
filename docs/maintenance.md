# Maintenance

Exact version pins age quickly, and AppKit changes often. Two pieces keep this
repository from rotting. Neither reaches a generated project.

## The workflow

`.github/workflows/check.yml` runs `pnpm run check` at the repository root. That
check generates projects from the checkout with the Databricks CLI, installs
each from its lockfile and runs the project's own `check` script, with no
workspace credentials: `apps init` gets a fake host and token, and nothing else
sees them.

It generates two projects, one after the other:

- **No plugins.** Its check must pass as it is.
- **Plugins.** The AppKit plugins listed in `plugins` in `scripts/check.mjs`,
  selected together, with made-up values for the resources each one asks for.
  A plugin can bring a fact that one of the project's
  waiting checks exists for: Lakebase's sample todo list writes data, so the
  check that wants the write target written down fires. Each such failure is
  listed in `expectedFailures`, with the lines it must print. The root check
  requires the failure to print exactly those lines, makes the change the
  message asks for, and then requires the project's whole check to pass. Any
  other failure fails the root check.

When a plugin is added to the template, add it to `plugins`. When a change
makes a plugin fire a waiting check, add the failure to `expectedFailures` only
if a developer selecting that plugin should see it; otherwise fix the template.

The second project roughly doubles the time a run takes.

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
updates together in one pull request. The three Node pins (`mise.toml`,
`generic/.nvmrc`, `generic/mise.toml.tmpl`) are one group too, held to Node 22
because that is the Databricks Apps runtime. It never automerges. A person merges each
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

## Agent skill pins

`generic/skills-lock.json` pins each shared agent skill to a commit of its
source repository, with a hash of the installed files. No Renovate manager reads
it, so the pins move only when someone updates them. The `skills` CLI does that
itself: `skills update` moves each skill's `commit` forward and rewrites its
`computedHash`. The CLI's version is pinned in `generic/.pre-commit-config.yaml`;
use that one.

To update the pins in this repository, work in an empty scratch folder, because
`skills update` acts on skills that are installed:

1. Copy `generic/skills-lock.json` into the folder.
2. Install what the lock records: `npx --yes skills@<version> experimental_install --frozen-lockfile -a universal`.
3. See what is newer with `npx --yes skills@<version> check`.
4. Run `npx --yes skills@<version> update -p -y`.
5. Copy the folder's `skills-lock.json` back to `generic/`, read the diff (each
   changed skill's `commit` and `computedHash` move), and commit it.

A project generated from the template does the same at its root: its post-checkout
hook has already installed the skills, so `npx --yes skills@<version> update -p -y`
is enough, and the project commits the changed lock.

Run it on a schedule you choose, such as when a skill's source repository
announces a change, and before a release of the template. The skills are
instructions that agents follow, so read the diff of the skills' own files
before committing the new pins, not only the lock.

## Taking AppKit's template changes

Renovate bumps the AppKit packages, but it cannot take changes to AppKit's own
project template. That is a separate, manual process, described in
[upstream.md](upstream.md).
