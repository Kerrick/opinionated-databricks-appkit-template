# The platform

Facts about Databricks Apps and AppKit that shape this project, and the traps
in them. Each fact says when it was last checked and where to check it again.
Versions and APIs here move quickly: check a fact before relying on it for a
change, and update its date when you do.

## Databricks Apps

### The runtime

A Node.js 22 container on Ubuntu 22.04. The default (Medium) size gives up to
2 vCPUs and 6 GB of memory; Large doubles both. An app can run several instances
behind one URL. `mise.toml` pins Node 22 locally to match.

Checked 2026-11-23 at
[system environment](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env)
and
[compute size](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/compute-size).

### What a deploy does

1. Installs dependencies with `pnpm install --frozen-lockfile`, because
   `pnpm-lock.yaml` is present. A lockfile out of step with `package.json`
   fails the deploy instead of being updated.
2. Runs the `build` script.
3. Runs the `command` from `app.yaml`.

pnpm apps get no default `command`; only npm apps fall back to `npm run start`.
The project's `app.yaml` sets it. `command` is a list of words, not a shell
string, and is run without a shell: the only variable substituted in it is
`DATABRICKS_APP_PORT`.

From a project directory, `databricks apps deploy` first validates the project
the way `databricks apps validate` does. Validation installs the dependencies
when `node_modules` is absent, then runs the `typegen`, `lint:ast-grep`,
`typecheck` and `build` scripts, and the `test` script when there is one.
`deploy` skips the tests by default (`--skip-tests=true`); `validate` runs them.
In this project `lint:ast-grep` is `appkit lint`, the only part of `lint` that a
deploy runs; the rest of `lint`, the tests and everything else in `check` run
before each commit instead. Those script names are the CLI's, so they stay.

Checked 2026-11-24 with `databricks apps deploy --help` and
`databricks apps validate --help`, Databricks CLI 1.27.0.

By default a deploy counts as successful as soon as the process starts. The
`health_check` in `app.yaml` (`path: /health`) makes it wait until the app
answers there. AppKit's server serves `/health`.

Checked 2026-11-23 at
[deploy](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy),
[dependencies](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/dependencies)
and
[app.yaml](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime).

### Limits

- **Port and host:** listen on `0.0.0.0` and the port in `DATABRICKS_APP_PORT`.
  A proxy in front terminates TLS. AppKit's server does both.
- **No durable filesystem:** files written at runtime are lost when the
  container is recycled, and other instances never see them. Keep data in Unity
  Catalog tables or volumes, or in Lakebase.
- **10 MB per file:** a larger file fails the deploy. Coverage, mutation and
  Playwright reports are generated output; check which files
  `databricks apps deploy` uploads before relying on `.gitignore` to keep them
  out.
- **Shutdown:** after SIGTERM the app has 15 seconds before SIGKILL.
- **No root:** no `apt-get` or other system packages. Everything comes from
  npm.
- **Logs:** only stdout and stderr are kept.

Checked 2026-11-23 at
[best practices](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices)
and in the runtime table of the `databricks-apps` skill's platform guide
(installed from `skills-lock.json`).

### Identity

Each app has its own service principal, whose credentials the platform injects.
On-behalf-of-user access instead forwards the signed-in user's token in the
`x-forwarded-access-token` header. It needs the matching `user_api_scopes` in
`databricks.yml` (such as `sql`, `files` or `genie`) and user authorization
turned on for the workspace. Which identity this app uses is an open question
(`docs/open-questions.md`).

Checked 2026-11-23 at
[authorization](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth).

## AppKit

AppKit is the TypeScript SDK Databricks publishes for Apps, in two packages.
`@databricks/appkit` is the server and its plugins; `@databricks/appkit-ui`
holds the React side, components on Radix and Tailwind and the hooks that load
data. Look up anything here with `npx @databricks/appkit docs <query>`. The
template this project came from pinned `@databricks/appkit` 0.103.0; see
`package.json` for the version in use now.

### The server

Every app has the server plugin, whatever else it selects. It starts Express
and gives each plugin its routes under `/api/<plugin>/`, plus a `/health` route.
In development it serves the client through Vite's middleware; in production it
serves the built files from whichever of `dist`, `client/dist`, `build`,
`public` and `out` it finds first. The app's own
routes go in `onPluginsReady(appkit) { appkit.server.extend(app => ...) }` or in
a custom plugin's `injectRoutes()`.

**Trap: Express 4.** The project's `@types/express` describes Express 5, but
the Express that AppKit runs is 4 (4.22 when checked). Express 5 passes a
failed `async` handler on to the error middleware. Express 4 ignores the
promise the handler returns, so a throw or a rejection there is lost, and
`asyncHandler` in `server/async-handler.ts` exists to forward it. Check the installed `express` version with
`pnpm why express` before relying on any Express 5 behavior.

Checked 2026-11-23 in AppKit's server plugin documentation and its
`packages/appkit/package.json`.

### Plugins

| Plugin                                          | What it does                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `analytics`                                     | Runs each `.sql` file in `config/queries/` on a SQL warehouse, and generates its types. `<key>.sql` runs as the service principal; `<key>.obo.sql` as the signed-in user |
| `lakebase`                                      | A Postgres connection pool for Lakebase. No HTTP routes                                                                                                                  |
| `database` (beta)                               | Generated CRUD routes over Lakebase tables                                                                                                                               |
| `genie`, `files`, `jobs`, `agents`, `ai-search` | Genie spaces, Unity Catalog volumes, jobs, agents and vector search                                                                                                      |
| `serving`                                       | Deprecated in favor of `agents`                                                                                                                                          |

**Trap: the `database` plugin has no authorization.** Its routes act with the
app's own identity and never ask who the user is. Whoever can reach them can
read, change or delete any row of any table they expose, through any operation
left on.

Responses are cached by default, in Lakebase when it is configured and healthy,
otherwise in memory. Configure it with `createApp({ cache })`.

Checked 2026-11-23 in AppKit's plugin documentation (`analytics`, `database`,
`caching`, `model-serving`).

### The data hooks

`@databricks/appkit-ui`'s hooks, `useAnalyticsQuery` among them, belong to the
component that calls them, not to a route:

- Each returns `data`, `loading`, `error`, `errorCode` and `warehouseStatus`.
- Components asking for the same query at the same time share one request.
- The request is torn down when its last component unmounts. Nothing is cached
  in the browser after that.
- They don't use Suspense.
- They handle streaming over server-sent events, Apache Arrow results, and the
  start-up of a stopped warehouse, which can take minutes and reports progress
  through `warehouseStatus`.
- They stream over `fetch`, not `EventSource`: a `POST` to
  `/api/analytics/query/<key>` whose response body is a `text/event-stream`.

**Trap: no typed client outside React.** AppKit documents no way for a route
loader to run an analytics query. Only the beta `database` plugin offers a
client that works outside a component: `databaseApi`, exported from
`@databricks/appkit-ui/js/beta`, whose calls return promises.
`docs/design/data-loading.md` says what follows from this.

Checked 2026-11-23 in AppKit's analytics plugin documentation, and in the
[AppKit repository](https://github.com/databricks/appkit) at
`packages/appkit-ui/src/react/hooks/use-analytics-query.ts` and
`packages/appkit-ui/src/js/sse/connect-sse.ts`.

### Charts

AppKit's charts are built on Apache ECharts and paint onto a canvas. Nothing in
the canvas has a role or text a test could query, and a click on a data point
needs a pointer; there is no keyboard equivalent.
ECharts can describe a chart to assistive technology, but its `aria` component
isn't loaded by default since ECharts 5. Registering it with `use` from
`echarts/core` reaches AppKit's charts only when the app's `echarts` is the same
module instance as `appkit-ui`'s, which is why the project depends on `echarts`
pinned to exactly the version `appkit-ui` depends on (`pnpm why echarts` shows
it). With `aria: { enabled: true }` in a chart's options (ECharts 6 deprecates
the older `aria.show`), ECharts gives the container `role="img"` and an
`aria-label` describing the data. [architecture.md](architecture.md) says where
the registration is and what guards it.

Checked 2026-11-23 in the AppKit repository's
`packages/appkit-ui/src/react/charts/base.tsx`, the
[ECharts accessibility guide](https://echarts.apache.org/handbook/en/best-practices/aria/)
and ECharts 6.1's `aria` source.

## The toolchain

### TypeScript 6 beside TypeScript 7

TypeScript 7.0 ships no JavaScript compiler API, and Microsoft recommends
running 6.0 beside it, through npm aliases, for tools that still need one. The
project installs both, pinned exactly:

- `"typescript": "npm:@typescript/typescript6@6.0.2"`. A tool that imports
  `typescript` gets 6.0: typescript-eslint, with the ESLint plugins built on it
  (`eslint-plugin-functional`, `eslint-plugin-jsdoc`), dependency-cruiser,
  Stryker's TypeScript checker, and AppKit's type generation.
- `"@typescript/native": "npm:typescript@7.0.2"`. The `tsc` command is 7.0, so
  `tsc -b` behaves as before, and `tsc6` runs 6.0.

The rest need nothing special and run against 7.0: `tsc -b` itself,
`@tsconfig/strictest`, oxlint's type-aware rules, knip and Vitest.

**Trap: an empty analysis passes.** On TypeScript 7.0, dependency-cruiser can
analyze zero modules without an error, so the architecture check fails when it
finds none.

Microsoft plans a new compiler API for TypeScript 7.1. When it ships, check
whether the tools above can drop 6.0.

Checked 2026-11-23 at
[Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

### Versions that must move together

- Every `@vitest/*` package shares Vitest's major version. The project stays on
  Vitest 4 until it upgrades all of them deliberately.
- oxlint is pinned exactly, because its JavaScript plugins (which load the React
  Compiler's rules) are alpha and outside semver.
- Every package is pinned to an exact version. Build tools can stay in
  `devDependencies`, because the platform's install doesn't skip them: only the
  `start` script sets `NODE_ENV=production`, after the build.

Checked 2026-11-23 in `package.json` and `.oxlintrc.json`.
