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
choice depends on something that hasn't happened yet, such as the first form,
a check fails at the moment it happens, naming the choice and the document that
explains it, instead of relying on someone remembering. Anthropic's
[hooks guide](https://code.claude.com/docs/en/hooks-guide) gives the same reason
for automation over instructions: the action always happens, rather than the
model choosing whether to do it.

## The gates

| Script          | Runs                                                                                                                                    | When                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `lint`          | The linters with zero-warning flags, the architecture rules, the structural rules, `appkit lint`, Prettier with `--check`, and sqlfluff | On every deploy, inside `databricks apps validate`     |
| `typecheck`     | `tsc -b`                                                                                                                                | On every deploy                                        |
| `test`          | Unit, component and page-level tests, with coverage thresholds and accessibility checks                                                 | In the git hook, and in CI                             |
| `test:e2e`      | Journeys through the built app, with Databricks faked                                                                                   | In the git hook, and in CI                             |
| `test:mutation` | Stryker, incrementally                                                                                                                  | In `check`, and in CI                                  |
| `test:smoke`    | Smoke journeys against the deployed app                                                                                                 | After each deploy only; it needs workspace credentials |
| `check`         | All of the above except `test:smoke`, plus knip and jscpd                                                                               | The Definition of Done: in the git hook, and in CI     |

The split follows the deploy. `databricks apps deploy` runs build, typecheck and
lint before it uploads anything
([app development](https://developers.databricks.com/docs/apps/development)), so
anything slow in `lint` slows every deploy. Tests, mutation testing and the
health metrics run in `check` instead.

The script names `build`, `typecheck`, `lint`, `test`, `sync` and `typegen` are
AppKit's, and the Databricks CLI calls them; they keep those names.

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
oxlint, with type-aware rules and the React Compiler's rules. It is fast enough
to run on every deploy. On top of the template's configuration:

- `typescript/no-explicit-any` is an error. The template only warns, so `any`
  passed the gate.
- `typescript/consistent-type-assertions` bans `as` assertions, in favor of
  annotations and `satisfies`; `typescript/no-non-null-assertion` bans `!`; and
  `typescript/switch-exhaustiveness-check` makes every `switch` over a union
  handle every member.
- `useMemo` and `useCallback` stay banned, as the template has them: the React
  Compiler memoizes.

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
and flags common code smells. It is LGPL-3.0, which matters only to code that
ships: it is a development tool, never part of the deployed app, and the project
doesn't modify it.

**Immutability in the domain.** `eslint-plugin-functional`, applied to the domain
layer only, with only its immutability rules such as `immutable-data`. Its
`no-classes` and `no-this-expressions` rules stay off, because the domain is
built from classes. A `no-restricted-syntax` rule bans setters there. The reasons
are in [architecture.md](architecture.md).

**Documentation.** `eslint-plugin-jsdoc` requires a JSDoc comment on every
export of the domain layer and of `server/`.

## Rules about structure

**Between modules: dependency-cruiser.** It
[validates dependencies against your own rules](https://github.com/sverweij/dependency-cruiser),
and holds every rule about what may import what (listed in
[architecture.md](architecture.md)). It fails when it analyzes no modules at
all, a silent failure TypeScript 7 can cause.

**Within a file: ast-grep.** Rules about the shape of code in one file are YAML
rules for `@ast-grep/cli`, the engine `appkit lint` already runs. Each rule has
its own tests. ESLint's `no-restricted-syntax` is used only for a selector that
fits on one line. The rules:

- every route has its own error element;
- every custom Express route validates its input with Zod;
- every `async` Express handler goes through the error-forwarding wrapper;
- nothing outside `acl/` calls `/api/*`;
- a plain `<form>` fails unless its component uses React Hook Form;
- no `fetch` inside a `useEffect` callback;
- tests find elements the way users do: no test IDs, CSS or XPath locators,
  `querySelector` or container queries.

Every failure message names the rule's reason and the document that explains it.

**Formatting: Prettier,** as the template ships it, with `--check` in `lint`.

**SQL: sqlfluff** with the `databricks` dialect lints `config/queries/`. The
`.sql` files are outside every TypeScript check, and warehouse SQL is Databricks
SQL. If Lakebase arrives, its SQL is Postgres, linted with the `postgres`
dialect, and its migrations checked by [squawk](https://squawkhq.com).

## The health of the code

- **knip** fails on unused files, exports and dependencies. AppKit's own
  repository uses it. Because of knip, a library is installed when the first
  code uses it and not before, and a check takes the place of the early
  install where the choice must be enforced.
- **jscpd** fails on duplicated code. It compares tokens, so copies that differ
  only in whitespace and formatting still match.
- **Complexity** comes from sonarjs, above.

## Bans with no check

Some rules in `AGENTS.md` have no reliable check: no hand-written types for SQL
results, no Lakebase SQL in `config/queries/`, and no custom endpoint for a
warehouse `SELECT`. Each stays in `AGENTS.md` with its reason. When a
deterministic check for one becomes possible, it moves into the tool that can
see it.

## The toolchain

**mise** pins Node 22 (to match the Databricks Apps runtime), pnpm (to match
`packageManager` in `package.json`), Python, sqlfluff and pre-commit.
`bin/setup` installs all of them, the dependencies and the git hooks.

**Exact versions** for every package, as AppKit's template already does. Build
tools stay in `devDependencies`; [platform.md](platform.md) says why that works
on the platform.

## Git hooks

The [pre-commit](https://pre-commit.com) framework, pinned with mise, runs
`pnpm run check` before every commit as a local hook with
`language: unsupported`, pre-commit 4.4's new name for `language: system`.

Other hooks install the shared agent skills listed in `skills-lock.json`
whenever a contributor checks out or merges, so every agent has them without
anyone remembering to install them. The skills are pinned like any dependency:
an update is a deliberate `npx skills update` and a reviewed commit.

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

A tool that doesn't read `AGENTS.md` gets the smallest adapter that points to it,
never a copy. Claude Code reads `CLAUDE.md` instead of `AGENTS.md` whenever a
`CLAUDE.md` exists, so:

- the root `CLAUDE.md` imports `AGENTS.md` and asks Claude Code not to use auto
  memory;
- every other folder with an `AGENTS.md` has a `CLAUDE.md` that only imports it;
- `.claude/settings.json` sets `autoMemoryEnabled` to `false`, because auto
  memory keeps its notes outside the repository, where no other contributor sees
  them;
- a hook in the same file runs oxlint on each file Claude Code edits, so
  feedback arrives in seconds. It is a convenience for one tool; `pnpm run check`
  is the gate for all of them.

Procedures worth repeating become [Agent Skills](https://agentskills.io/specification)
in `.agents/skills/`, the folder that many tools share. A skill is written only
after its procedure has been done once for real, so that it records what
happened. Each `SKILL.md` stays under 500 lines and 20,000 characters, about the
5,000 tokens the specification recommends.

## Where knowledge goes

| Knowledge                                           | Home                                            |
| --------------------------------------------------- | ----------------------------------------------- |
| Rules for every contributor and agent               | `AGENTS.md`                                     |
| The few decisions that would take a rewrite to undo | `docs/decisions/`, written with the `adr` skill |
| How the system works, and why each tool was chosen  | `docs/design/`                                  |
| Questions only the team can answer                  | `docs/open-questions.md`                        |
| The work ahead                                      | `docs/plan.md`                                  |
| Procedures worth repeating                          | `.agents/skills/`                               |

Tool and library choices never become decision records: they are cheap to
change, and nothing else rests on them, so they live here. A decision log is
worth reading only while it is short and true.
