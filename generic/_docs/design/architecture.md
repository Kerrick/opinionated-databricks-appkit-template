# Architecture

How the code is organized, what each part may depend on, and why. Two
decisions underlie everything here and have records of their own in
`docs/decisions/`: the app is a single-page app on AppKit's Express server
(record 0001), and the client is layered, with an anti-corruption layer around
AppKit (record 0002). How data reaches the screen without waterfalls is in
[data-loading.md](data-loading.md).

## The pieces

```text
client/src/
  pages/          view: one component per route
  components/     view: everything else that renders
  acl/            application: the only code that knows how data arrives
  domain/         domain: the business's concepts and rules
  lib/            the cn helper AppKit's UI components use, outside the layers
  design/         the design plugin's development pages, outside the layers
server/           AppKit's server, its plugins and the app's own routes
config/queries/   SQL for the SQL warehouse, one file per query
shared/           types both sides import; AppKit writes its generated ones here
```

Some of these arrive later. `domain/` starts with only its `AGENTS.md`,
`design/` comes with the design plugin, and `config/queries/` comes with the first analytics query.
`shared/appkit-types/` is written by `appkit generate-types`, which runs before
every build and with `pnpm run typegen`.

The view renders, the application layer turns data from outside into domain
objects, and the domain layer holds the rules. Each layer can be understood,
and tested, while the others are held still: Martin Fowler's case for
[layering presentation, domain and data](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
is that it lets you think about each of them relatively independently.

### View

`pages/` and `components/` hold function components and hooks only, following
React's rules that
[components and hooks are pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure).
They hold no business logic and never call `fetch`; data comes from route
loaders or from hooks in `acl/`.

**Components that fetch for themselves.** A few of AppKit's components load
their own data, so they can't be handed domain objects, and a view may render
them as they are:

- AppKit's chart and table components take a query key and load its rows. A
  view may use them to show those rows unchanged. Once anything interprets the
  rows, the data goes through `acl/` instead.
- `GenieChat` holds a whole conversation with a Genie space. The page that
  comes with the Genie plugin renders it and nothing else.

Every other request goes through `acl/`.

**Every route has an error element.** Each route in `App.tsx` names
`components/RouteError.tsx` as its `errorElement`, so a loader that throws or a
page that fails to render shows what went wrong and a way home, not a blank
screen. `components/ErrorBoundary.tsx` at the root catches anything outside the
router.

**Every page owns its one `h1`.** A page supplies the top-level heading that
names it, and the layout in `App.tsx` supplies none: the app's name in the
header is plain text, so a page that renders without the header (the not-found,
load-failure and crash pages) still has exactly one, and none shows two. A new
page must supply one, and axe's `page-has-heading-one` rule fails its scenario
otherwise ([testing.md](testing.md#accessibility-checks)). Sub-headings sit one
level below.

AppKit's components such as `CardTitle` and `EmptyTitle` render their title as
a `div`, so the page gives it its level with `role="heading"` and `aria-level`
(`<CardTitle role="heading" aria-level={1}>`). That keeps the look the component
was styled with, where swapping in an `h1` element would not.

### Charts

AppKit's charts are drawn on a canvas, so screen readers and tests can't find
their data unless ECharts' accessibility support is on ([platform.md](platform.md)
says how it works). The template ships no chart, so it ships no chart wrapper
either, but it does ship the support itself and the boundary charts must respect:

1. `main.tsx` calls `registerChartAccessibility()` once at startup. It registers
   ECharts' `AriaComponent` (from `echarts/components`) with `use` from
   `echarts/core` (`components/charts/register-accessibility.ts`).
2. `echarts` is a dependency of the project, pinned to exactly the version
   `@databricks/appkit-ui` depends on. The registration reaches AppKit's charts
   only when both import the same copy of ECharts, so `tools/echarts-pin.test.ts`
   fails when the versions differ or the project installs a second copy, and
   `register-accessibility.browser.test.ts` fails when the registration is
   missing. When AppKit moves to another ECharts, move the pin with it.
3. Charts are imported only through wrappers in `client/src/components/charts/`,
   one per chart type. A wrapper sets `aria: { enabled: true }` in the chart's
   options; it is written with the first chart that needs one.

A wrapper is not written before its chart, because a wrapper nothing uses is
dead code that knip fails. Where users act on a chart's data, the page also
offers a way to reach that data by keyboard, such as a table of the same rows.

### Application

`acl/` is an anti-corruption layer: the
[pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer)
of a translating layer between two subsystems that don't share the same
semantics. The rows AppKit's generated types describe are the SQL warehouse's
model, shaped by tables someone else owns. The app's model is the domain layer.
Each data need gets one hook in `acl/`, named for the domain concept it returns,
that wraps AppKit's hook and maps rows to domain objects. When a table changes
shape, one mapping function changes, and nothing that renders or decides does.

`acl/` is the only folder in the client that may:

- import AppKit's generated types or call AppKit's data hooks;
- call `fetch`, or name an `/api/` path. `acl/fetch-or-throw.ts` is the helper
  for the app's own endpoints: it fetches, turns an error response into a
  thrown error, and checks the JSON against a Zod schema.

The layout check and the import rules also accept a `client/src/hooks/` folder
in this layer, for hooks built on `acl/`: state that several components share,
or a combination of several data needs. The template ships none.

### Domain

`domain/` is plain TypeScript with no imports from React, AppKit, the other
layers or the browser, so its rules run and are tested in Node.

**Objects never change.** Fields are `readonly`, there are no setters, and a
method that changes something returns a new instance (`invoice.withDueDate(d)`).
React decides what to re-render by comparing references, and the React
Compiler, which this project runs with its `immutability` rule on, assumes that
nothing it is given is mutated. An object changed in place can leave a stale
screen with no error anywhere.

**Classes carry behavior.** This is the one layer where classes are welcome. A
class that holds only data, with the rules in a separate service, is what Martin
Fowler calls an
[anemic domain model](https://martinfowler.com/bliki/AnemicDomainModel.html),
which gives up the point of objects: keeping data and the process that uses it
together. So:

- Classes are named for the concept, never for a role ending in "-er" or "-or":
  `Invoice`, not `InvoiceManager`. Yegor Bugayenko's
  [case against such names](https://www.yegor256.com/2015/03/09/objects-end-with-er.html)
  is that they describe a procedure, not an object.
- Behavior that varies by kind is a class per kind (polymorphism, or a
  strategy), not a conditional over a type field. A `switch` over a
  discriminated union is fine where only the data varies, provided it is
  exhaustive.
- One class per file.

### Server

`server/server.ts` creates the AppKit app with its plugins. The app's own routes
go in `onPluginsReady`, through `appkit.server.extend`, or in a custom AppKit
plugin with `injectRoutes()`. Custom routes are only for what AppKit's plugins
don't do: writes, Databricks APIs with no plugin, logic over several steps,
external services and file processing. Reading from a SQL warehouse or a Unity
Catalog volume always goes through a plugin; Databricks' own guidance for AppKit
apps says not to add custom endpoints for warehouse queries.

Every route validates its body, parameters and query string with Zod, as
[Databricks' best practices](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices)
ask for every app, internal ones included.

Every `async` handler is wrapped in `asyncHandler` from
`server/async-handler.ts`, which passes a thrown error or a rejected promise to
`next(err)`. AppKit runs Express 4, which ignores the promise an `async` handler
returns, so without the wrapper a failure never reaches the error middleware and
the request hangs until the client gives up
([platform.md](platform.md) has the details). Its test shows a failing handler
getting an error response.

If the app turns out to own bounded contexts (see below), a custom AppKit plugin
per context, each with its own routes, resources and tests, is an option to
weigh then.

### Shared

`shared/` holds only types: AppKit's generated query types
(`shared/appkit-types/`) and anything else both sides need to agree on. It holds
no logic, with one exception, the domain layer once it moves there.

## What may depend on what

dependency-cruiser checks these rules on every `pnpm run lint`:

- `client/` never imports `server/`, and `server/` never imports `client/`.
- `domain/` stays plain TypeScript: no import from another client folder, from
  React, from AppKit or from a chart library.
- Only `acl/` imports AppKit's generated types.
- Only `components/charts/` imports a chart library.
- Nothing imports a server-rendering framework (`next`, `@react-router/dev`,
  `@tanstack/react-start`).
- No import cycles, and no module that nothing imports.

Lint rules on `domain/` enforce the rest of that layer's rules: immutable data
(`eslint-plugin-functional`'s immutability rules), no setters, no agent-noun
class names, one class per file, and exhaustive `switch` statements.

Structural rules (ast-grep) check single files across the client and the server:

- only `acl/` calls AppKit's data hooks, calls `fetch` or names an `/api/` path;
- no `fetch` inside a `useEffect` callback;
- only `components/charts/` imports AppKit's charts;
- every route has an error element;
- a plain `<form>` fails unless its file uses React Hook Form (see
  [Libraries for client concerns](#libraries-for-client-concerns));
- every `async` Express handler goes through `asyncHandler`, and every handler
  that reads the request validates it with Zod.

[tooling.md](tooling.md) lists every tool and why it was chosen.

## Exceptions in AppKit's own files

A few files that came from AppKit's template needed a place in the layers, or
an exception to them:

- `client/src/components/ErrorBoundary.tsx` is a class component, the one in the
  view layer, because React has no hook that catches render errors.
- `client/src/acl/fetch-or-throw.ts` is the helper AppKit's pages used to call
  the server. It calls `fetch`, so it lives in `acl/`, the one layer allowed to.
- `client/src/lib/` holds `utils.ts`, with the `cn` helper that combines
  Tailwind class names for AppKit's UI components. It sits outside the layers.
- `client/src/design/` holds the design plugin's development-only pages, also
  outside the layers.

`lib/` and `design/` are the only folders under `client/src/` besides the
layers' own.

## When server code needs the domain's rules

Sooner or later a route has to apply a rule the client already applies, such as
validating a write against the same business limits. The server can't import
`client/src/domain/`: the dependency rules forbid `server/` from importing
`client/`. Copying the rules into `server/` would let the two copies drift, and
jscpd fails the build on the duplicate. Both paths are closed on purpose, so the
domain layer moves at that moment, once, to where both sides can import it:

1. Move `client/src/domain/` to `shared/domain/`, with its tests, its
   `AGENTS.md` and its `CLAUDE.md`.
2. Update the imports in the client.
3. Point the domain-layer rules at the new path: the dependency-cruiser rules
   (`shared/` may then hold the domain as well as types, and `server/` may import
   it), the ESLint and oxlint rules scoped to `domain/`, and the files Stryker
   mutates.
4. Make sure both `tsconfig.client.json` and `tsconfig.server.json` include
   `shared/domain/`.
5. Update this document, the root `AGENTS.md` and `server/AGENTS.md`.

The move is a consequence of record 0002, not a decision of its own: the layers
and their rules stay the same, and only the folder that holds the domain moves.
It needs no new record.

## Bounded contexts

Whether the organization divides its business into bounded contexts, and where
this app sits among them, is an open question (`docs/open-questions.md`). The
answer changes the structure: one folder per owned context with a public
`index.ts` and boundaries between them, an anti-corruption layer per upstream
context, or no translation at all inside a context the app doesn't own. In
Martin Fowler's description of a
[bounded context](https://martinfowler.com/bliki/BoundedContext.html), each has
a unified model of its own, so translation is needed only where two models meet.

Until the question is answered, the client has only the folders above, and a
new top-level folder under `client/src/` fails the build with a message pointing
at the question ([tooling.md](tooling.md) lists the checks that wait like this).

## Libraries for client concerns

- **Routing:** React Router 7 in data mode (`createBrowserRouter`), as AppKit's
  template ships it. Every route has an `errorElement`.
- **Server state:** route loaders and actions that call functions in `acl/`.
  TanStack Query joins them when the app first needs a cache shared across
  routes and components; [data-loading.md](data-loading.md) says how.
- **Shared client state:** React Context, and no store library. Passing data
  deep into the tree is what
  [`useContext`](https://react.dev/reference/react/useContext) is for, and
  nothing yet needs more.
- **Errors:** `ErrorBoundary.tsx` at the root, plus each route's error element.
  No error library.
- **Forms:** two kinds, and a check keeps them apart.
  - A form that only submits to a route action, with no validation in the
    browser, is React Router's `<Form>`. The action parses the form data with
    Zod. The Lakebase sample's todo list works this way.
  - A form that checks its fields in the browser, as the user types or before
    it submits, is built with React Hook Form (`react-hook-form`) and its Zod
    resolver (`@hookform/resolvers`). The resolver takes the same Zod schema
    the server checks the request with, so the browser and the server agree on
    what is valid, and every form shows its errors the same way.

  React Hook Form is installed with the first form that needs it, not before,
  because knip fails the build on an unused dependency. A plain `<form>` fails
  the structural check unless its file uses React Hook Form, so no form is built
  a third way.

## Storage

- **Reads** come from SQL warehouses over Unity Catalog, through the `analytics`
  plugin and the query files in `config/queries/`.
- **Lakebase** is used only once the team confirms it. Its SQL never goes in
  `config/queries/`, which is for the warehouse.
- **Writes** wait for the team's decision on where they go
  (`docs/open-questions.md`). `INSERT`s into Delta through a warehouse take
  seconds each and aren't built for updating single rows; Lakebase is; an
  existing system may already own the data. The `database` plugin's generated
  routes have no per-user authorization (`platform.md`), so a design document
  must say how authorization works before it is registered.
