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

From a project directory, `databricks apps deploy` first runs the same
validation as `databricks apps validate`: build, typecheck and lint, but not the
tests. So the `lint` script runs on every deploy and must stay fast.

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

"AppKit" is Databricks' TypeScript SDK: `@databricks/appkit`, the server, and
`@databricks/appkit-ui`, React components and data hooks built on Radix and
Tailwind. Look up anything here with `npx @databricks/appkit docs <query>`. The
template this project came from pinned `@databricks/appkit` 0.103.0; see
`package.json` for the version in use now.

### The server

The server plugin is always present. It runs an Express server, mounts each
plugin's routes at `/api/<plugin>/...`, adds `/health`, runs Vite as middleware
in development, and in production serves the static build from the first of
`dist`, `client/dist`, `build`, `public` and `out` that exists. The app's own
routes go in `onPluginsReady(appkit) { appkit.server.extend(app => ...) }` or in
a custom plugin's `injectRoutes()`.

**Trap: Express 4.** AppKit runs Express 4 (4.22 when checked), although the
template installs Express 5's type definitions. In Express 4 an error thrown, or
a promise rejected, inside an `async` handler doesn't reach the error-handling
middleware; Express 5 forwards it. Check the installed `express` version with
`pnpm why express` before relying on any Express 5 behavior.

Checked 2026-11-23 in AppKit's server plugin documentation and its
`packages/appkit/package.json`.

### Plugins

| Plugin                                          | What it does                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analytics`                                     | SQL warehouse queries written as files in `config/queries/`, with generated types. `<key>.obo.sql` runs as the signed-in user; `<key>.sql` as the service principal |
| `lakebase`                                      | A Postgres connection pool for Lakebase. No HTTP routes                                                                                                             |
| `database` (beta)                               | Generated CRUD routes over Lakebase tables                                                                                                                          |
| `genie`, `files`, `jobs`, `agents`, `ai-search` | Genie spaces, Unity Catalog volumes, jobs, agents and vector search                                                                                                 |
| `serving`                                       | Deprecated in favor of `agents`                                                                                                                                     |

**Trap: the `database` plugin has no authorization.** It runs as the service
principal, with no per-user or per-row checks: anyone who can reach its routes
can perform every enabled operation on every exposed row, deletes included.

Responses are cached by default, in Lakebase when it is configured and healthy,
otherwise in memory. Configure it with `createApp({ cache })`.

Checked 2026-11-23 in AppKit's plugin documentation (`analytics`, `database`,
`caching`, `model-serving`).

### The data hooks

`useAnalyticsQuery` and the other hooks in `@databricks/appkit-ui` load data per
component, not per route:

- They return `{ data, loading, error, errorCode, warehouseStatus }`.
- Components asking for the same query at the same time share one request.
- The request is torn down when its last component unmounts. Nothing is cached
  in the browser after that.
- They don't use Suspense.
- They handle streaming over server-sent events, Apache Arrow results, and the
  start-up of a stopped warehouse, which can take minutes and reports progress
  through `warehouseStatus`.
- They stream over `fetch`, not `EventSource`: a `POST` to
  `/api/analytics/query/<key>` whose response body is a `text/event-stream`.

**Trap: no typed client outside React.** There is no documented way to run an
analytics query from a route loader. The beta `database` plugin does have one,
`databaseApi` from `@databricks/appkit-ui/js/beta`, which returns promises.
`docs/design/data-loading.md` says what follows from this.

Checked 2026-11-23 in AppKit's analytics plugin documentation and the source of
`use-analytics-query.ts` and `connect-sse.ts` in `appkit-ui`.

### Charts

AppKit's charts are Apache ECharts drawn on a canvas, so a test can't find
their data by role or text, and their click handlers work only with a pointer.
ECharts can describe a chart to assistive technology, but its `aria` component
isn't loaded by default since ECharts 5. Registering it with `use` from
`echarts/core` reaches AppKit's charts only when the app's `echarts` is the same
module instance as `appkit-ui`'s, which is why `echarts` is pinned to exactly
the version `appkit-ui` depends on. With `aria: { enabled: true }` in a chart's
options (ECharts 6 deprecates the older `aria.show`), ECharts gives the
container `role="img"` and an `aria-label` describing the data.

Checked 2026-11-23 in `appkit-ui`'s `charts/base.tsx`, the
[ECharts accessibility guide](https://echarts.apache.org/handbook/en/best-practices/aria/)
and ECharts 6.1's `aria` source.

## The toolchain

### TypeScript 6 beside TypeScript 7

TypeScript 7.0 ships no JavaScript compiler API, and Microsoft recommends
running 6.0 beside it, through npm aliases, for tools that still need one. The
project installs both, pinned exactly:

- `"typescript": "npm:@typescript/typescript6@6.0.2"`, so every tool that
  imports `typescript` gets 6.0. That includes typescript-eslint (and through it
  `eslint-plugin-functional` and `eslint-plugin-jsdoc`), dependency-cruiser,
  Stryker's TypeScript checker, and AppKit's own type generation.
- `"@typescript/native": "npm:typescript@7.0.2"`, so `tsc` is 7.0 and
  `tsc -b` is unchanged. `tsc6` runs 6.0.

These work with 7.0 as they are: oxlint's type-aware rules, knip, Vitest,
`@tsconfig/strictest` and `tsc -b`. ts-morph bundles its own 6.0.

**Trap: an empty analysis passes.** On TypeScript 7.0, dependency-cruiser can
analyze zero modules without an error, so the architecture check fails when it
finds none.

Revisit all of this at TypeScript 7.1, which Microsoft expects to bring a new
API.

Checked 2026-11-23 at
[Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

### Versions that must move together

- Every `@vitest/*` package shares Vitest's major version. The project stays on
  Vitest 4 until it upgrades all of them deliberately.
- oxlint is pinned exactly, because its JavaScript plugins (which load the React
  Compiler's rules) are alpha and outside semver.
- Every package is pinned to an exact version. Build tools stay in
  `devDependencies`: the platform installs them, because `NODE_ENV=production`
  is set only by the `start` script.

Checked 2026-11-23 in `package.json` and `.oxlintrc.json`.
