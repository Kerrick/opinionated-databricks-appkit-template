# Tooling and gates

Which tools check this project, how they are arranged into gates, and why each
was chosen. Tests have their own document, [testing.md](testing.md).

## Why so much tooling

Most of the code in this project will be written by coding agents, and an agent
follows the checks that fail far more reliably than the prose that asks. So the
project leans on deterministic tools:

- **One command says whether work is done.** `pnpm run check` runs everything,
  and passes only with zero errors and zero warnings. A warning that is allowed
  to stay is a warning nobody reads.
- **A rule that a tool can check is a check.** Architecture and naming are lint
  rules, not paragraphs. Where a rule can't be checked, `AGENTS.md` keeps it with
  its reason.
- **Escape hatches are visible.** Every disable comment must say why it exists.
- **Tests must prove something.** Coverage is total, and mutation testing checks
  that the tests notice when the code changes.
- **The health of the code is measured:** duplication, complexity and unused
  code each fail the build.
- **The toolchain is pinned,** from Node to each npm package, so every machine
  runs the same checks.
- **Knowledge lives in the repository,** in plain files any agent reads.

A document read at the wrong moment, or never, enforces nothing. So where a
choice depends on something that hasn't happened yet, such as the first write
route, a check fails at the moment it happens, naming the choice and the
document that explains it, instead of relying on someone remembering
([Checks that wait for a project fact](#checks-that-wait-for-a-project-fact)).
Anthropic's [hooks guide](https://code.claude.com/docs/en/hooks-guide) gives the
same reason for automation over instructions: the action always happens, rather
than the model choosing whether to do it.

## The gates

`pnpm run check` is the gate: the Definition of Done, the git hook before every
commit, and the one command a CI pipeline needs. It runs these scripts in order,
and stops at the first that fails:

| Order | Script          | Runs                                                                                                                                             |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | `typecheck`     | `tsc -b`, over the client, the server, the tests and `tools/`                                                                                    |
| 2     | `lint`          | oxlint, ESLint, dependency-cruiser, the ast-grep rules and their tests, `appkit lint`, sqlfluff and squawk, the size check, the triggered checks |
| 3     | `format`        | Prettier with `--check`                                                                                                                          |
| 4     | `knip`          | Unused files, exports and dependencies                                                                                                           |
| 5     | `jscpd`         | Duplicated code                                                                                                                                  |
| 6     | `test`          | Unit, property and page-level tests, with 100% coverage per file and accessibility checks; installs Chromium first                               |
| 7     | `test:mutation` | Stryker, incrementally, at a score of 100                                                                                                        |
| 8     | `build`         | The server with tsdown and the client with Vite, after AppKit's plugin sync and type generation                                                  |
| 9     | `test:e2e`      | Journeys through the built app, with Databricks faked                                                                                            |

The cheap checks come first, so a typing or lint mistake fails in seconds. The
journeys come last because they drive what `build` produced.

`lint` runs its parts in this order: `lint:oxlint`, `lint:eslint`,
`lint:boundaries` (dependency-cruiser), `lint:structure` (the ast-grep rules'
own tests, then the scan), `lint:ast-grep` (`appkit lint`), `lint:sql`,
`lint:sizes` and `lint:triggers`.

`pnpm run test:smoke` runs the journeys tagged `@smoke` against a deployed app.
It needs a workspace, so it is never part of `check`
([testing.md](testing.md)).

A deploy runs only part of this. `databricks apps deploy` validates the project
first with the `typegen`, `lint:ast-grep`, `typecheck` and `build` scripts, and
skips `test` unless told otherwise ([platform.md](platform.md)). Those names are
the CLI's and stay as they are. Everything else in `check` runs before each
commit instead.

## TypeScript

**`@tsconfig/strictest`.** `tsconfig.shared.json` extends it, keeping AppKit's
settings for modules and output. AppKit's template stops at `"strict": true`;
strictest adds flags such as
[`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html),
which makes an array or record lookup possibly `undefined`, as it is at runtime.

**TypeScript 6 beside 7.** The tools that need a compiler API get 6.0 through
an npm alias; `tsc` stays 7.0. [platform.md](platform.md) explains it.

## Linting

**oxlint first, ESLint for what oxlint lacks.** AppKit's template already runs
oxlint, with type-aware rules and the React Compiler's rules. It is fast. On top
of the template's configuration:

- `typescript/no-explicit-any` is an error. The template only warns, so `any`
  passed the gate.
- `typescript/consistent-type-assertions` bans `as` assertions, in favor of
  annotations and `satisfies`; `typescript/no-non-null-assertion` bans `!`; and
  `typescript/switch-exhaustiveness-check` makes every `switch` over a union
  handle every member.
- `useMemo` and `useCallback` stay banned, as the template has them: the React
  Compiler memoizes.
- In the domain layer, one class per file, and no browser globals.

ESLint, with [typed linting](https://typescript-eslint.io/getting-started/typed-linting)
from typescript-eslint, runs only rules oxlint doesn't have: `naming-convention`
(the ban on agent-noun class names), and the plugins below. Before adding a rule
to ESLint, check whether oxlint has it. A rule is never on in both.

**Disable comments.**
`@eslint-community/eslint-plugin-eslint-comments` requires a description on
every disable comment
([`require-description`](https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/require-description.html))
and fails on disables that no longer suppress anything.

**Complexity.** `eslint-plugin-sonarjs` measures
[cognitive complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)
and flags common code smells.

**Immutability in the domain.** `eslint-plugin-functional`, applied to the domain
layer only, with only `immutable-data` and `no-let`. Its `no-classes` and
`no-this-expressions` rules stay off, because the domain is built from classes.
A `no-restricted-syntax` rule bans setters there. The reasons are in
[architecture.md](architecture.md).

**Documentation.** `eslint-plugin-jsdoc` requires a JSDoc comment on every
export of the domain layer and of `server/`.

**Journeys.** `eslint-plugin-playwright` checks the files that drive the built
app, and keeps their locators to what a person sees.

## Rules about structure

**Between modules: dependency-cruiser.** It
[validates dependencies against your own rules](https://github.com/sverweij/dependency-cruiser),
and holds every rule about what may import what (listed in
[architecture.md](architecture.md)). `tools/check-boundaries.ts` runs it and
fails when it analyzes no modules at all, a silent failure TypeScript 7 can
cause.

**Within a file: ast-grep.** Rules about the shape of code in one file are YAML
rules in `rules/`, for `@ast-grep/cli`, the engine `appkit lint` already runs.
Each rule has tests in `rule-tests/`, which run before the scan, so a rule that
stops matching fails the build. ESLint's `no-restricted-syntax` is used only for
a selector that fits on one line. The rules:

| Rule                                     | Fails on                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `route-needs-error-element`              | a route with no `errorElement`                                                               |
| `express-handler-validates-input`        | a route handler that reads the body, parameters or query string without Zod                  |
| `express-async-handler-wrapped`          | an `async` Express handler not wrapped in `asyncHandler`                                     |
| `no-warehouse-reads-in-custom-endpoints` | a custom endpoint that reads the SQL warehouse                                               |
| `network-only-in-acl`                    | `fetch`, or an `/api/` path, outside `client/src/acl/`                                       |
| `appkit-data-hooks-only-in-acl`          | one of AppKit's data hooks called outside `client/src/acl/`                                  |
| `appkit-charts-only-in-wrappers`         | one of AppKit's charts imported outside `client/src/components/charts/`                      |
| `no-fetch-in-effect`                     | `fetch` inside a `useEffect` callback                                                        |
| `form-uses-form-library`                 | a plain `<form>` in a file that doesn't use React Hook Form                                  |
| `queries-use-generated-types`            | a type argument on `useAnalyticsQuery` or `useMetricView`, which replaces the generated type |
| `tests-find-elements-like-users`         | a Vitest test that finds elements by test ID, CSS or XPath selector, or container            |

Every failure message names the rule's reason and the document that explains it.

**AppKit's own rules.** `lint:ast-grep` runs `appkit lint`, AppKit's own checks
of how its plugins are used. The script keeps its name because
`databricks apps validate` calls it.

**Formatting: Prettier,** as the template ships it, through the `format` script
in `check`. `format:fix` rewrites.

**SQL: sqlfluff** with the `databricks` dialect lints `config/queries/`. The
`.sql` files are outside every TypeScript check, and warehouse SQL is Databricks
SQL. With Lakebase, its SQL is Postgres, linted with the `postgres` dialect from
`config/database/.sqlfluff`, and its migrations are checked by
[squawk](https://squawkhq.com) for changes that lock tables or break running
code. `tools/lint-sql.ts` runs whichever of these the project's SQL files need.

**Instruction files stay short.** `tools/check-sizes.ts` fails when the root
`AGENTS.md` reaches 12,000 characters, an `AGENTS.md` below it 4,000, or a
`SKILL.md` the project wrote 500 lines or 20,000 characters
([Coding agents](#coding-agents) says why).

## The health of the code

- **knip** fails on unused files, exports and dependencies. AppKit's own
  repository uses it. Because of knip, a library is installed when the first
  code uses it and not before, and a check takes the place of the early
  install where the choice must be enforced.
- **jscpd** fails on duplicated code. It compares tokens, so copies that differ
  only in whitespace and formatting still match.
- **Complexity** comes from sonarjs, in [Linting](#linting).

## Checks that wait for a project fact

`tools/check-triggers.ts`, run by `lint:triggers`, holds checks that stay quiet
until the project learns something that needs a decision first. Each fails with
a message that names what to do. The template's own documents carry none of the
headings they ask for, because only the project can write what goes under them.

| The check fails when                                                                                       | It passes once                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a folder under `client/src/` is none of `components`, `pages`, `hooks`, `acl`, `domain`, `lib` or `design` | the bounded-contexts question in `docs/open-questions.md` is answered, and the list in `tools/triggers/layout.ts` and [architecture.md](architecture.md) are extended to match   |
| any file under `server/`, tests aside, registers a route that isn't `GET`                                  | a Markdown file in `docs/design/` has a heading that reads exactly "Write target", with text under it saying where writes go and why                                             |
| `server/server.ts` registers `lakebase()` or `database()`, or a `migrations` folder exists                 | a `.sqlfluff` with `dialect = postgres` sits in `config/database/` or in the migrations folder, and `mise.toml` pins squawk. The template ships both when Lakebase is selected   |
| `server/server.ts` registers `database()`                                                                  | also, a Markdown file in `docs/design/` has a heading that reads exactly "Per-user authorization", with text under it saying how users are kept to their own rows and operations |
| a query file is named `*.obo.sql`                                                                          | `databricks.yml` lists `sql` under `user_api_scopes`, and user authorization is on for the workspace                                                                             |

Why each one waits:

- **An unknown folder** usually means a bounded context has arrived, and the
  app's place among the organization's contexts decides how the client is
  organized ([architecture.md](architecture.md)).
- **The first write route** means the app writes, and where writes go
  (Lakebase, Delta through the warehouse, or a system that already owns the
  data) changes everything downstream.
- **Lakebase** brings Postgres SQL and migrations, which the warehouse's linting
  doesn't cover.
- **The `database()` plugin** generates create, read, update and delete routes
  that run as the app's service principal, with no per-user or per-row check
  ([platform.md](platform.md)).
- **An on-behalf-of-user query** runs as the signed-in user, which the platform
  allows only with the `sql` scope.

**Selecting Lakebase fails the check on purpose.** AppKit's Lakebase plugin
comes with a sample todo list whose routes create, update and delete rows, so a
project generated with Lakebase fails the write-route check from its first run.
A project that writes data has to say where writes go before its check passes,
even when the answer is the sample's own Lakebase table.

**Selecting AI Search fails `appkit lint` on purpose.** A Vector Search index
returns only the columns the project names, and `appkit lint` fails while
`aiSearch()` names none, because such an index fails in production. Which
columns a search returns is the project's decision, so the template doesn't
guess. To pass, name them in `server/server.ts`:
`aiSearch({ indexes: { default: { columns: ['id', 'title'] } } })`, with the
index's own columns.

## Bans with no check

A few rules in `AGENTS.md` have no reliable check, and stay there with their
reasons: no Lakebase SQL in `config/queries/`, no forcing an install past an
error, and calling AppKit's data hooks at the top of a page rather than behind
another query's loading state ([data-loading.md](data-loading.md)). When a
deterministic check for one becomes possible, it moves into the tool that can
see it.

## The toolchain

**mise** pins the tools outside npm, in `mise.toml`: Node 22 (to match the
Databricks Apps runtime), pnpm (to match `packageManager` in `package.json`),
Python and uv, pre-commit, sqlfluff, pixi on Linux (for the browser's
libraries, [testing.md](testing.md)), and squawk when Lakebase is selected.
`.nvmrc` names the same Node version for tools that read it.

Setting up a fresh clone takes three commands, and none of them needs root:

```sh
mise install                # the pinned tools
pnpm install                # the dependencies, from pnpm-lock.yaml
mise run hooks              # the git hooks, and the agent skills
```

**Exact versions** for every package, as AppKit's template already does. Build
tools stay in `devDependencies`; [platform.md](platform.md) says why that works
on the platform.

## Git hooks

The [pre-commit](https://pre-commit.com) framework, pinned with mise, reads
`.pre-commit-config.yaml`. `pre-commit install` installs every hook type that
file lists, and `mise run hooks` runs it for you:

- **Before each commit,** `pnpm run check`. The hook is local and declares
  `language: unsupported`, so pre-commit runs the command with the tools
  already installed; pre-commit 4.4 renamed `language: system` to that.
- **After each checkout and merge,** the shared agent skills are restored
  ([Coding agents](#coding-agents)). Git has run neither hook yet in a fresh
  clone, so `mise run hooks` also runs the restore once, and the agents have
  their skills as soon as setup ends.

`pre-commit install` refuses to run when git's `core.hooksPath` is set, and a
global git configuration can set it. Unset it, or set it to the repository's own
hooks folder (`.git/hooks`), before `mise run hooks`.

## Licences of development tools

Three development tools carry licences with conditions that a permissive
licence doesn't have: `eslint-plugin-sonarjs` is LGPL-3.0, and `axe-core` and
`@axe-core/playwright` are MPL-2.0. Their conditions apply to distributing the
tools, or modified copies of them. The project runs them only in development and
in its checks, and never modifies them. They are `devDependencies` that the
running app never loads, and neither the server bundle nor the client build
includes them. So they are installed like every other tool, with nothing to
flag or exempt.

## Coding agents

`AGENTS.md` is the one source of instructions for every coding agent, in the
[AGENTS.md](https://agents.md) format, which most coding agents read. The root
file holds the rules for everyone; the folders with rules of their own (the
domain layer, `acl/` and `server/`) have their own, and the file nearest to the
edited one applies. The root stays under 12,000 characters and each folder's
under 4,000: Anthropic's
[guidance on instruction files](https://code.claude.com/docs/en/memory) is that
longer files consume more context and are followed less closely, and counting
characters stops one long paragraph from passing a line limit.

An agent that reads some other file is given one as small as it can be, which
sends it to `AGENTS.md`. The rules are never copied into it. Claude Code reads `CLAUDE.md` instead of `AGENTS.md` whenever a
`CLAUDE.md` exists, so:

- the root `CLAUDE.md` imports `AGENTS.md` and says why auto memory is off;
- every other folder with an `AGENTS.md` has a `CLAUDE.md` that only imports it;
- `.claude/settings.json` sets `autoMemoryEnabled` to `false`. Auto memory
  keeps Claude Code's notes outside the repository, where no other contributor,
  and no other agent, ever sees them; everything worth keeping belongs in the
  repository instead;
- a hook in the same file runs oxlint on each file Claude Code edits
  (`tools/oxlint-edited-file.ts`) and hands the findings back to it, seconds
  after the edit. Only Claude Code gets this shortcut; every agent, Claude Code
  included, still has to pass `pnpm run check`.

### Shared agent skills

Every contributor's agents need the same skills: Databricks' own
(`databricks-apps`, `databricks-lakebase` and the others listed in the lock),
plus `adr` and `skill-authoring`, which the project's decision records and
skills are written with. `skills-lock.json` pins each one to a
commit of its source repository, with a hash of its files. A post-checkout and
post-merge hook restores them from the lock with the `skills` CLI (its version
pinned in `.pre-commit-config.yaml`), linked into `.agents/skills/` and Claude
Code's `.claude/skills/`. So nobody has to remember to install them, and nobody
gets a different version.

Their files are never committed: `.gitignore` lists them, and the lock is the
record. Updating them is deliberate: `npx skills@<version> update -p -y` at the
project's root moves each skill's pin, and the change is a reviewed commit. Read
the diff of the skills themselves, not only the lock, because agents follow
what they say.

### The project's own skills

Procedures worth repeating become [Agent Skills](https://agentskills.io/specification)
in `.agents/skills/`, the folder that many tools share. A skill is written only
after its procedure has been done once for real, so that it records what
happened. The size check keeps each `SKILL.md` below 500 lines and 20,000
characters, close to the specification's advice of 5,000 tokens at most.

## Where knowledge goes

| Knowledge                                           | Home                                            |
| --------------------------------------------------- | ----------------------------------------------- |
| Rules for every contributor and agent               | `AGENTS.md`                                     |
| The few decisions that would take a rewrite to undo | `docs/decisions/`, written with the `adr` skill |
| How each part works, and the reasons for each tool  | `docs/design/`                                  |
| Questions only the team can answer                  | `docs/open-questions.md`                        |
| The work ahead                                      | `docs/plan.md`                                  |
| Procedures worth repeating                          | `.agents/skills/`                               |

Tool and library choices never become decision records: they are cheap to
change, and nothing else rests on them, so they live here. The fewer records
the log holds, the more likely each one is read, and kept true.
