# Opinionated Databricks AppKit template

[![Template check](https://github.com/Kerrick/opinionated-databricks-appkit-template/actions/workflows/check.yml/badge.svg?branch=trunk)](https://github.com/Kerrick/opinionated-databricks-appkit-template/actions/workflows/check.yml)
[![License: MIT-0](https://img.shields.io/badge/license-MIT--0-blue)](LICENSE)

A template for [Databricks Apps](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/) written with [AppKit](https://github.com/databricks/appkit), Databricks' TypeScript SDK. You run it with the Databricks CLI's `apps init` command. It gives you a React single-page app on AppKit's Express server, plus one command, `pnpm run check`, that fails on type errors, lint warnings, unused code, duplicated code, missing tests, tests that prove nothing, and a broken build.

It is for a developer or a team starting a Databricks App who needs those rules in place on the first day, and who works with coding agents that follow checks more reliably than prose.

The default template that `databricks apps init` uses is AppKit's. This template starts from a copy of it and changes it in these ways:

- Every rule that a tool can check is a check that fails the build, including the layering of the client code.
- Tests and the tools that check them are part of the project from the start.
- The sample pages that need data a workspace may not have are removed.
- It ships instructions for coding agents, in the [AGENTS.md](https://agents.md) format.

[docs/upstream/README.md](docs/upstream/README.md) lists every difference from AppKit's template.

## Start a project

You need the [Databricks CLI](https://docs.databricks.com/aws/en/dev-tools/cli/install) signed in to your workspace. Run:

```sh
databricks apps init --template https://github.com/Kerrick/opinionated-databricks-appkit-template
```

The CLI asks for a project name and which plugins to enable, then asks for the resources each plugin needs. To skip the questions, pass them as flags. This creates `my-app` with the analytics and Genie plugins, in the current folder:

```sh
databricks apps init \
  --template https://github.com/Kerrick/opinionated-databricks-appkit-template \
  --name my-app \
  --features analytics,genie \
  --set analytics.sql-warehouse.id=<warehouse-id> \
  --set genie.genie-space.id=<space-id> \
  --set genie.genie-space.name="<space name>"
```

Then, in the new folder:

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run dev
```

The project pins its tools with [mise](https://mise.jdx.dev/) (`mise install` installs them) and runs the checks before each commit through [pre-commit](https://pre-commit.com) (`mise x -- pre-commit install` turns that on). The generated `README.md` and `AGENTS.md` cover everything from there to deployment.

## What a generated project comes with

- **App.** A React 19 client built with Vite, Tailwind CSS and shadcn/ui, served by AppKit's Express server. It has a home page, a page for unknown addresses, and an error page for routes that fail to load. `databricks.yml` and `app.yaml` are set up for `databricks apps deploy`.
- **Layers.** The client has a view layer, an application layer in `client/src/acl/` (the only place that calls `fetch` or AppKit's data hooks), and a domain layer of plain immutable objects. Lint rules enforce the boundaries.
- **One gate.** `pnpm run check` runs, in order, the type check, lint, formatting, unused-code, duplicate-code, unit and page-level tests (100% coverage per file, with accessibility checks), mutation tests, the build, and end-to-end journeys through the built app.
- **Tests with no workspace.** Page-level tests run in a real browser and the journeys fake Databricks, so `check` needs no credentials.
- **Pinned tools.** Every npm package is pinned to an exact version, and mise pins Node 22 (the Databricks Apps runtime), pnpm and the other tools.
- **Instructions for agents.** `AGENTS.md` at the root and in the folders with rules specific to them, each with a `CLAUDE.md` that imports it, plus a pinned set of shared agent skills that a git hook restores after each checkout. Claude Code also gets a hook that runs oxlint on each file it edits.
- **Project documents.** After `pnpm install`, `docs/` holds design documents for the architecture, data loading, the platform, testing and tooling, two decision records, a list of open questions only your team can answer, and a plan.

A generated project has no CI workflow, because where it runs is your choice. `pnpm run check` is the one command a pipeline needs. It has no `LICENSE` either: [License](#license) explains which files carry a notice.

## What it leaves out

There is no example query, page or test for analytics. AppKit generates a query's types from a real SQL warehouse, and no dataset exists in every workspace, so any example query would fail somewhere. The first query you add goes in `config/queries/`. Run `pnpm run typegen` and commit the types it writes to `shared/appkit-types/`: when no warehouse can be reached, AppKit falls back to the committed types.

The other plugins are cut the same way where AppKit's sample needed data or a service a workspace may lack, or broke the project's layering rules. The table below says what each plugin has.

## Plugins

Select plugins with `--features`, separated by commas. The server plugin is always on.

| Plugin                            | What a generated project has                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `analytics`                       | The plugin, with no query and no page.                                                                                            |
| `genie`                           | A page that renders AppKit's `GenieChat`.                                                                                         |
| `lakebase`                        | A sample todo list: a page, its requests in `acl/`, and routes on the server. Also pins squawk, which checks migrations. |
| `design`                          | Development-only pages: `/design` renders `client/src/design/index.tsx`.                                                          |
| `agents` (beta)                   | The plugin, with no agents. Each agent is a folder in `server/agents/`.                                                           |
| `aiSearch` (beta)                 | The plugin, with no page. Its check fails until you name the columns a search returns.                                            |
| `files`                           | The plugin's routes under `/api/files/`, with no page.                                                                            |
| `jobs`                            | The plugin's routes under `/api/jobs/`, with no page.                                                                             |
| `serving`                         | The plugin's routes under `/api/serving/`, with no page. AppKit deprecates it in favor of `agents`.                               |

A project generated with one of these plugins fails a check on purpose, until you act on what the message says:

- **Lakebase.** The sample todo list has routes that are not `GET`, and `lint:triggers` fails when no document in `docs/design/` records where writes go. Add a "Write target" section to `docs/design/architecture.md` that says where writes go and why, even if the answer is the sample's Lakebase table.
- **AI Search.** `appkit lint` fails while `aiSearch()` in `server/server.ts` names no columns, because such an index fails in production. Name them, for example `aiSearch({ indexes: { default: { columns: ['id', 'title'] } } })`.

Two more checks wait for a fact about your project and stay quiet until it arrives. A folder under `client/src/` that is not one of the known layers fails `lint:triggers`, until you answer the question about bounded contexts in `docs/open-questions.md`. A query file named `*.obo.sql` fails until `databricks.yml` lists the `sql` scope under `user_api_scopes`.

## Requirements and platforms

- **No root.** No setup step or check needs root, on any operating system. On Linux, the libraries that Playwright's Chromium needs come from conda-forge through [pixi](https://pixi.sh) into the project's `.pixi/` folder, instead of from the system package manager.
- **No workspace credentials.** `pnpm run check` never contacts a workspace. The one test run that needs a deployed app, `pnpm run test:smoke`, is not part of `check`.
- **Platforms.** Generated projects are built for Linux (x86-64 and Arm), macOS and Windows.
- **Node.** Node 22.23.4 or later. mise pins Node 22, the version the Databricks Apps runtime uses.

## Check the template

The repository's check generates two projects from the checkout with the Databricks CLI. The first has no plugins. The second has every plugin from the table, and the check requires the two failures described above, with exactly the messages a developer would see. Each project is then installed from its lockfile and must pass `pnpm run check`. It needs network access, and no credentials: it gives `databricks apps init` a made-up host and token, which the CLI requires and never uses.

With [mise](https://mise.jdx.dev/), which installs the pinned Node, pnpm and Databricks CLI, run from the root of this repository:

```sh
mise x -- pnpm run check
```

On GitHub's runners, a run lasts about 12 to 14 minutes.

## Documentation

- [docs/upstream/README.md](docs/upstream/README.md): how the template relates to AppKit's, every change made to it, how to take later upstream changes, and drafts of reports to upstream projects.
- [docs/maintenance.md](docs/maintenance.md): the workflow that runs the check, how dependency updates and the pinned agent skills are kept current, and the GitHub settings that no file can make.

## Reporting problems

Open an [issue](https://github.com/Kerrick/opinionated-databricks-appkit-template/issues). Say which plugins you selected, and include the output of the command that failed.

## License

The files written for this template are licensed [MIT-0](LICENSE). The files in `generic/` derive from the project template in [AppKit](https://github.com/databricks/appkit), Copyright 2022 Databricks, Inc., licensed under the Apache License 2.0. A generated project receives `APPKIT-TEMPLATE-LICENSE` (the Apache-2.0 text) and `APPKIT-TEMPLATE-NOTICE.md`, which cover the files that came from AppKit's template. The license of your project is yours to choose: the generated `package.json` says `Unlicensed` until you do.

## How this was made

I use four words for how code and prose comes to exist. Code or prose I wrote, I typed by hand, with nothing generated. Code or prose I wrought, an AI agent generated while I iterated with it, and I reviewed every change before committing it, so I own every diff. Code or prose I requested, an agent built with little or no review from me, but I take ownership of the outcome or product because I tested and iterated. Code or prose I rushed, an agent built with little or no feedback from me, and may or may not be useful (or safe).

Everything in this repository that isn't copied from AppKit's template (the scripts, the changes to the template, its documents, and this README) is rushed. In place of review, the repository's check generates projects from it and runs `pnpm run check` in each, which requires zero warnings, 100% coverage and mutation testing to pass. [declare-ai.org](https://declare-ai.org/1.0.0/total.html)
