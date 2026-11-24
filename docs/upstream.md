# Upstream

The template in `generic/` is a fork of the AppKit project template.

| | |
| --- | --- |
| Upstream repository | https://github.com/databricks/appkit |
| Path | `template/` |
| Commit | `8b99a203e4b3422936231fb185154d9e31064846` |
| `@databricks/appkit` pinned there | 0.103.0 (the npm `latest` at that time was 0.104.0) |
| License | Apache-2.0 |

`generic/` started as a verbatim copy of `template/` at that commit. The
changes made since are listed under "Changes from upstream" below.

## Attribution

The files in `generic/` derive from the AppKit template, Copyright 2022
Databricks, Inc., which is licensed under the Apache License, Version 2.0
(https://github.com/databricks/appkit/blob/main/LICENSE). The upstream template
files carry no per-file license headers, so there are none to keep. Where a
file was modified, "Changes from upstream" says so, and a generated project
receives `APPKIT-TEMPLATE-LICENSE` (the Apache-2.0 text) and
`APPKIT-TEMPLATE-NOTICE.md` (the notice). Everything else in this repository is
Copyright Kerrick Long and licensed MIT-0 (see `LICENSE`).

## Taking later upstream changes

Do this in a scratch folder outside the checkout. Never run anything from the
fetched sources.

1. Diff `template/` between the old pin (`OLD`, the commit in the table above)
   and the commit to take (`NEW`), with paths relative to `template/`:

   ```sh
   git clone --filter=blob:none --no-checkout https://github.com/databricks/appkit.git appkit
   git -C appkit diff --relative=template --binary OLD NEW -- template/ > upstream.patch
   ```

2. Apply it to `generic/`, from the root of this checkout, with a clean working
   tree:

   ```sh
   git apply --3way --directory=generic path/to/upstream.patch
   ```

   Resolve conflicts with "Changes from upstream" in hand: each entry there is
   a place where `generic/` differs on purpose.

3. Update the commit and the pinned `@databricks/appkit` version in the table
   above, and add to "Changes from upstream" for any new local change.
4. Run `pnpm run check` at the repository root.
5. Land it as one commit on the trunk.

## Changes from upstream

Every difference between `generic/` and `template/` at the pinned commit. A
later upstream merge should keep these. Lines changed for formatting only
follow from running Prettier 3.6.2 with the template's own `.prettierrc.json`
over the generated project.

### Plugin samples

Upstream ships sample code for most plugins: a page, and for some plugins
queries, agents or routes. Each sample here was either brought into line with
the project's rules, or cut to the code the plugin's wiring needs. The wiring
itself is unchanged in every case: the registration in `server/server.ts`, the
resources and scopes in `databricks.yml`, `app.yaml` and the environment files,
and the conditionals around them. Samples were cut when following the rules
would have meant rewriting a demo that a project replaces anyway, and always
when the sample needs data that a workspace may not have. The root check
generates a project with these plugins selected and runs its check.

- `analytics`: cut. `config/queries/hello_world.sql`,
  `config/queries/mocked_sales.sql` and `client/src/pages/analytics/` are gone,
  with the page's route and link in `client/src/App.tsx`. AppKit generates a
  query's types from the warehouse, so a project with a query builds without
  credentials only once those types are committed, and types written by hand
  would be a guess. With no query, the build generates empty types and passes.
  The page also called the data hooks and the charts from a view, which the
  layers forbid. `config/metric-views/definitions.json` stays: it is
  configuration, and empty. `README.md.tmpl` says why there is no sample query
  and that the generated types should be committed. `.prettierignore` skips
  `shared/appkit-types/`, which type generation rewrites, unformatted, on every
  build.
- `agents`: cut. `client/src/pages/agents/` (a chat page) and `server/agents/`
  (a planner agent, a helper agent with two demonstration tools, and a skill)
  are gone, with the page's route and link. The page streamed from the agent
  routes inside a view, kept message state by hand and used a plain form, and
  the agents are a demonstration a project would delete. The plugin starts
  with no agents and says so in its log. `README.md.tmpl` says where agents go.
- `aiSearch`: cut. `client/src/pages/ai-search/` is gone, with its route and
  link. A search result's fields are whichever columns the project's index
  returns, so there is no domain object to map them to until the project
  chooses them, and the page called AppKit's search hook from a view. The
  registration stays `aiSearch()`, as upstream writes it: which columns a
  search returns is the project's choice, and `appkit lint` fails, saying so,
  until it is made. The root check expects that failure. `README.md.tmpl` says
  what to set.
- `design`: kept. `client/src/design/index.tsx` is the file the plugin renders
  at `/design` in development, not a demonstration, and it already follows the
  rules. Nothing imports it or the pages the plugin serves beside it, so
  `knip.json` names `client/src/design/**/*.tsx` as entry points, inside the
  plugin's conditional so that a project without the plugin gets no hint about
  a pattern that matches nothing. (`knip.json` is rendered as a template for
  that reason.)
- `files`: cut. `client/src/pages/files/` is gone, with its route and link. It
  was a volume browser of almost 400 lines that fetched from the view, posted
  plain forms and failed the type and lint checks, and it needs a volume with
  files in it. A project's own file features call the plugin's routes from
  `acl/`. `README.md.tmpl` says so.
- `genie`: kept as it was. `client/src/pages/genie/GeniePage.tsx` renders
  AppKit's `GenieChat` and nothing else, which is how a project uses the
  plugin, and it passes every check. `GenieChat` talks to its Genie space
  itself, like AppKit's charts, so `_docs/design/architecture.md` names it
  beside them as a component a view may render as it is.
- `jobs`: cut. `client/src/pages/jobs/` is gone, with its route and link. It
  triggered and followed runs of the configured job with requests and a
  stream read inside the view, posted plain forms, and failed the lint checks.
  What a project shows about its job, and when it may start a run, is its own
  decision. `README.md.tmpl` says to call the plugin's routes from `acl/`.
- `serving`: cut. `client/src/pages/serving/` is gone, with its route and
  link. It was a chat with the serving endpoint that streamed from the view
  and posted a plain form, for a plugin AppKit deprecates in favor of
  `agents`. `README.md.tmpl` says so, and to call the plugin's routes from
  `acl/`.

Added files:

- `.gitattributes`: every text file is checked out with LF line endings. A
  Windows checkout with `core.autocrlf=true` otherwise writes CRLF, and the
  format check fails on nearly every file. The repository root has the same
  file for the same reason.
- `APPKIT-TEMPLATE-LICENSE`: the Apache-2.0 text, copied from upstream's
  `LICENSE`.
- `APPKIT-TEMPLATE-NOTICE.md`: names the AppKit template, the commit and that
  the files were modified. Neither is called `LICENSE`, which belongs to the
  generated project.
- `scripts/typegen-production.mjs`: runs `appkit generate-types --wait` with
  `NODE_ENV=production`, for `prebuild`.

Modified files:

- `package.json`: new `check` script (typecheck, lint, format check, test,
  build, in that order). `prebuild` calls `scripts/typegen-production.mjs`
  instead of `NODE_ENV=production appkit generate-types --wait`, which fails on
  Windows.
- `pnpm-workspace.yaml`: `sideEffectsCache: false`. With pnpm 11.0.8,
  installing the project a second time from a warm store leaves out the packages that
  `@databricks/appkit` bundles (`@databricks/sdk-statementexecution` among
  them), so importing `@databricks/appkit` throws "Cannot find package
  '@databricks/sdk-statementexecution'", which is how `pnpm run test` failed.
  The first, cold install is fine. Turning the side-effects cache off fixes the warm
  install (checked with the flag on a store that had already failed);
  `--package-import-method=copy` does not.
- `.prettierrc.json`: an override for `databricks.yml` that keeps double
  quotes, because `databricks.yml.tmpl` writes `"{{.projectName}}"`.
- `.prettierignore`: `appkit.plugins.json`, which the build rewrites, and `shared/appkit-types/`, which type generation rewrites.
- `README.md.tmpl`: a blank line after `**Enabled plugins:**`, and the
  package manager is written as `pnpm` instead of `{{or .packageManager "pnpm"}}`,
  with a sentence saying the project uses pnpm only.
- `app.yaml.tmpl`: the start command names `pnpm` for the same reason.
- `package-lock.json`: removed. The template is pnpm-only and its check
  installs with pnpm from `pnpm-lock.yaml`. Upstream's npm lockfile would go
  stale as dependencies change, and Renovate would try to keep both current.
- `server/server.ts`: the plugin list is written on one line, which is how
  Prettier prints it for every plugin selection.
- `client/src/ErrorBoundary.tsx` moved to `client/src/components/ErrorBoundary.tsx`, and `client/src/lib/fetch-or-throw.ts` to `client/src/acl/fetch-or-throw.ts`, so that both live in a layer. `main.tsx` and `acl/todos.ts`, which imports `fetch-or-throw`, follow.
- `package.json`, `tsconfig.json` and `tsconfig.tools.json`: a `tools/` project (typechecked with `tsc -b`, run with `tsx`) holding the repository checks, and the `lint:triggers` script that `lint` runs.
- `tools/`: new. Checks that stay quiet until the project learns something: an unknown folder under `client/src/`, a first non-GET custom server route, Lakebase arriving, and an on-behalf-of-user query.
- `tsconfig.shared.json` extends `@tsconfig/strictest` (added to `devDependencies`) and keeps only the module and emit settings. The strictest preset adds `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` and `isolatedModules`, so the `ErrorBoundary` and `example.test.ts` class members gained `override`.
- `package.json`: `typescript` is now an alias of `@typescript/typescript6` 6.0.2 (the compiler API that typescript-eslint, dependency-cruiser and Stryker's checker call), and `@typescript/native` aliases `typescript` 7.0.2, which keeps `tsc` at 7.0. `tsc6` is the 6.0 compiler. AppKit's type generation also imports `typescript`, so it now runs on 6.0.
- `.oxlintrc.json`: added `typescript/switch-exhaustiveness-check`, and `max-classes-per-file` (one class per file) for `client/src/domain/`. `lint:oxlint` runs with `--deny-warnings`.
- `eslint.config.js`: new flat config for what oxlint lacks: `naming-convention` (no agent-noun class names in the domain), disable-comment hygiene, sonarjs, functional's immutability rules and a setter ban in the domain, and JSDoc on exports from the domain and `server/`. The `lint` script now runs oxlint, ESLint and the triggered checks in turn.
- `client/src/App.tsx`, `client/src/components/ErrorBoundary.tsx`, `server/example.test.ts`: small edits so the new rules pass (readonly props, one return type, `static readonly`).
- `server/routes/lakebase/todo-routes.ts`: a doc comment on the exported setup function, which the JSDoc rule requires.
- `package.json`: a `postinstall` script runs `tools/unpack-docs.ts`
  (a new file). The project's documents ship in `generic/_docs/` and that
  script renames the folder to `docs/` on the first install. The reason is that
  `databricks apps init` never copies a directory named `docs`, at any depth,
  even when the files in it end in `.tmpl` (its skip list in
  `cmd/apps/init.go`). Leading underscores are the convention the CLI already
  uses for files it must not treat as live (`_gitignore`). After the rename the
  script deletes itself and `tools/unpack-docs.test.ts`, and removes the
  `postinstall` key from `package.json` (rewritten the way Prettier prints
  it), so a generated project keeps nothing of the mechanism and its own
  documents never mention it. The script does nothing once `docs/` exists. It
  also does nothing in `generic/` itself, where `package.json` still holds the
  unrendered project name, so installing inside the template doesn't break it.
  The root check asserts that a generated project, after install, has `docs/`,
  no `tools/unpack-docs.*` and no `postinstall` script.
- Formatting only: `client/src/App.tsx`, `client/src/index.css`,
  `client/src/acl/fetch-or-throw.ts`, `client/src/main.tsx`,
  `client/vite.config.ts`, `client/src/pages/lakebase/LakebasePage.tsx`,
  and `server/routes/lakebase/todo-routes.ts`.

When a later upstream change touches a formatting-only file, take it, then
format that file the way `generic/` does: strip any `{{if ...}}` wrapper
lines, run Prettier on the body, and put the wrapper back.
- `.dependency-cruiser.mjs` and `tools/check-boundaries.ts`: new. Import-graph rules (layers, client against server, domain isolation, generated types only in `acl/`, chart libraries only in `components/charts/`, no cycles, no orphans, no server-rendering frameworks), run through a wrapper that fails when no modules were analysed. `lint:boundaries` is part of `lint`. `.oxlintrc.json` bans browser globals in the domain.
- `sgconfig.yml`, `rules/`, `rule-tests/`: new. Structural rules checked one file at a time with `@ast-grep/cli` (added to `devDependencies` and to `allowBuilds` in `pnpm-workspace.yaml`): routes have an `errorElement`, route handlers validate input with Zod and async handlers go through `asyncHandler`, network calls and `/api/` paths stay in `acl/`, no `fetch` in an effect, plain forms need React Hook Form, Vitest tests avoid test IDs and selectors, and AppKit's charts and analytics hooks stay in their layers. Each rule has tests; `lint:structure` runs them before scanning.
- `server/async-handler.ts`: new, with a test that a failing handler gets an error response.
- `client/src/components/RouteError.tsx`: new. `client/src/App.tsx` names it as the `errorElement` of every route.
- `mise.toml.tmpl`, `.sqlfluff`, `config/database/.sqlfluff.tmpl`, `tools/lint-sql.ts`: new. The toolchain is pinned (Node, pnpm, Python, uv, pre-commit, sqlfluff, and squawk when Lakebase or the database plugin is selected). `config/queries` is linted as Databricks SQL, Lakebase SQL as Postgres, and migrations also go through squawk. `lint:sql` runs whichever apply and is part of `lint`, with `lint:ast-grep` (`appkit lint`).
- `client/src/acl/todos.ts`, `client/src/pages/lakebase/LakebasePage.tsx`, `client/src/App.tsx`, `server/routes/lakebase/todo-routes.ts`: the sample todo list loads through a route loader and submits through React Router forms, with its requests in `acl/`, and the sample routes use `asyncHandler` and validate `:id` with Zod. The sample still does what it did; it now follows the project's own rules.
- `tools/check-sizes.ts`: new. The root `AGENTS.md` stays under 12,000 characters, each `AGENTS.md` below it under 4,000, and each project-owned `SKILL.md` (not those installed from `skills-lock.json`) under 500 lines and 20,000 characters. `lint:sizes` is part of `lint`.
- `rules/queries-use-generated-types.yml`, `rules/no-warehouse-reads-in-custom-endpoints.yml`: new. A type argument on `useAnalyticsQuery` replaces the generated row type, and a custom endpoint that reads the warehouse (the analytics plugin, a statement-execution or SQL client) bypasses the plugin's cache, types and per-user execution.
- `.pre-commit-config.yaml`: new. One local hook runs `pnpm run check` (`language: unsupported`) on every commit.
- `.claude/settings.json`, `tools/oxlint-edited-file.ts`: new. For Claude Code, a post-edit hook that runs oxlint on the file just edited and sends findings back to the agent. It is a convenience; `pnpm run check` stays the gate.
- `knip.json`, `.jscpd.json`, `package.json`: unused files, exports and dependencies (knip) and duplicate code (jscpd) are checked by `check`. `embla-carousel-react`, `next-themes` and `react-resizable-panels` are gone from `dependencies`: nothing in the starter imports them, `@databricks/appkit-ui` carries the ones it needs, and the shadcn CLI adds them when a component needs them. `tw-animate-css` stays, because `@databricks/appkit-ui`'s stylesheet imports it and the build can't resolve it otherwise; `knip.json` lists it, with `@ast-grep/napi` (loaded by `appkit lint`) and the PostCSS packages, as dependencies knip can't see being used.
- `vitest.config.ts`: a coverage block (v8, 100% per file over `client/src` and `server`, the two start-up files excluded) with `@vitest/coverage-v8` and a `test:coverage` script. It is off by default until the tests reach the thresholds.
- `server/routes/lakebase/todo-routes.ts`: the update and delete routes share one helper, which keeps the sample under the duplicate-code threshold.
