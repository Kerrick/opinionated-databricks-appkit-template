# Open questions

Every question here is the team's to answer, because the answer depends on the
organization, its data or its habits rather than on anything in the code.
Answering them is the first item in the [plan](plan.md).

When a question is answered:

1. Record the answer where it now belongs: a design document in `docs/design/`,
   an architecture decision record in `docs/decisions/` if it passes the test
   there, `AGENTS.md`, or a configuration file.
2. Change whatever the answer changes, in the same commit.
3. Delete the question from this file.

Until a question is answered, the project runs on the default its entry names.

## The domain

### Does the organization model its business as bounded contexts?

If it does, find out whether a context map exists and where. The app's place in
it decides how the client code is organized:

| The app's place                                 | What follows                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| It owns one or more contexts                    | A top-level folder per owned context, each with a public `index.ts`, and boundary rules between them. The domain model for each lives there. A custom AppKit plugin per context, with its own `/api/<name>` routes and tests, is worth weighing. |
| It is a view over contexts that other teams own | An anti-corruption layer per upstream context, contract tests against each upstream, and as few business rules in TypeScript as possible.                                                                                                        |
| It lives inside one context that it doesn't own | No anti-corruption layer and no context folders: the app uses that context's model and terms as they are, and generates its types from the context's own source of truth.                                                                        |
| A mix of these                                  | Anti-corruption layers only where the app reads a context other than its own.                                                                                                                                                                    |

Default: no context folders. The client has only its layers, described in
`docs/design/architecture.md`. A new top-level folder under `client/src/` fails
the build until this question is answered.

### Is there a shared glossary, and where?

The terms in scenarios, domain classes and page text should be the business's
own. If the organization keeps a glossary (per context, if it uses contexts),
link it from `AGENTS.md` so every contributor and agent uses the same words.

Default: the team's own words, kept consistent within the project.

## Data and identity

### Which data does the app read, and through which SQL warehouse?

Name the Unity Catalog catalogs and schemas, the warehouse, the people who own
those schemas, and who may change their structure. A change of structure there
changes the app's generated query types, so the app's owners need to hear of it
first.

Default: nothing. The first analytics query, and the first vertical slice in the
plan, wait for this answer.

### Does the app write data, and where should writes go?

The candidates differ a lot. Lakebase (managed Postgres) handles transactional
updates. `INSERT` statements into Delta tables through the SQL warehouse take
seconds each and aren't meant for updating single rows. An existing system may
already own the data. Also find out whether Lakebase is enabled in the
workspace.

Default: the app doesn't write. The first custom route that isn't a `GET`
fails the build until a document in `docs/design/` has a "Write target" section
saying where writes go and why. A project generated with the Lakebase plugin
meets that check at once, because the plugin's sample todo list writes. Using
`lakebase()` or `database()` also turns on the checks Lakebase needs: Postgres
linting for its SQL, and squawk for its migrations. The `database()` plugin has
no per-user authorization (`docs/design/platform.md`), so it also needs a
"Per-user authorization" section in a design document.
`docs/design/tooling.md` lists each of these checks and what it needs.

### Should queries run as each signed-in user or as the app's service principal?

Running as the user (on-behalf-of-user access) applies that user's Unity Catalog
permissions to every query. It needs user authorization turned on in the
workspace, a `sql` entry in `user_api_scopes` in `databricks.yml`, and query
files named `*.obo.sql`. Running as the service principal gives every user the
same access, which is the app's own.

Default: the service principal, as AppKit's analytics plugin does unless a query
file is named `*.obo.sql`.

## Delivery

### Which workspaces are for development, staging and production?

Also decide whether the bundle in `databricks.yml` is how the app is deployed,
and which package registry installs go through.

Default: the workspace and profile given to `databricks apps init`, used for
everything.

### Which CI system does the team use?

The project ships no CI configuration. `pnpm run check` is the whole gate and
runs the same way on any CI system, so a pipeline needs only a Node 22 runner,
the tools in `mise.toml`, `pnpm install --frozen-lockfile` and
`pnpm run check`. The smoke journeys (`pnpm run test:smoke`) run against the
deployed app after each deploy, which needs the next answer.

Default: no CI. The git hook runs `pnpm run check` before each commit.

### How does CI sign in to the deployed app?

The app sits behind Databricks sign-in, so a CI job that runs the smoke journeys
against it has to authenticate as someone. Decide which identity it uses and how
it gets a token.

Default: the smoke journeys run only by hand, by someone signed in.

## How the team works

### What may coding agents do with git without asking?

Choose among staging, committing, pushing, and pushing to the main branch.
Record the answer in the "Committing" section of `AGENTS.md`. The same section
asks for commit messages in the Conventional Commits form; keep that or replace
it with the team's own convention.

Default: agents commit and push nothing without asking.

### Which coding agents do contributors use?

`AGENTS.md` serves most agents as it is. Claude Code needs the `CLAUDE.md` files
beside each `AGENTS.md`, and the git hook that installs shared skills links them
into the folders of the agents it names (`universal`, which is the shared
`.agents/skills/` folder, and `claude-code`). Add an adapter for any agent that
reads neither `AGENTS.md` nor `.agents/skills/`, and add it to the hook's list.
Remove the Claude Code adapters if nobody uses Claude Code.

Default: adapters for Claude Code, and `AGENTS.md` for everything else.

### Will businesspeople take part in writing and reading the scenarios?

Gherkin's value is that people outside engineering can read and help write the
scenarios, worked out together in Example Mapping sessions. If they will take
part, keep the scenarios in `.feature` files. If only engineers will read them,
plain TypeScript tests are simpler: write the scenarios as test files that call
the same tasks, and remove the Gherkin runners. `docs/design/testing.md` lists
the steps.

Default: Gherkin.

### What is the policy on license headers?

Decide whether source files carry a license or copyright header (for example
SPDX identifiers, following REUSE), and what it says for proprietary code.

Default: no headers. The files that came from AppKit's template keep the
Apache-2.0 notice that ships with the project.
