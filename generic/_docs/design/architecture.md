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
  pages/        view: one component per route
  components/   view: everything else that renders
  hooks/        application: the app's own hooks, built on acl/
  acl/          application: the only code that knows how data arrives
  domain/       domain: the business's concepts and rules
server/         AppKit's server, its plugins and the app's own routes
config/queries/ SQL for the SQL warehouse, one file per query
shared/         types both sides import, including AppKit's generated ones
```

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
loaders or from hooks in `acl/` and `hooks/`.

AppKit's chart and table components are the one place a view fetches for
itself: they take a query key and load their own rows, so they can't be handed
domain objects. A view may use them to show a query's rows as they are. Once
anything interprets the rows, the data goes through `acl/` instead.

Charts are drawn on a canvas, so each chart type gets one wrapper in
`components/charts/` that turns on ECharts' accessibility (`aria.enabled`, with
the `aria` component registered once at the app's root), and only those
wrappers import AppKit's charts. Where users act on a chart's data, the page also
offers a way to reach it by keyboard, such as a table of the same rows. The first
chart adds the first wrapper; `platform.md` says why the `echarts` version is
pinned.

### Application

`acl/` is an anti-corruption layer: the
[pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer)
of a translating layer between two subsystems that don't share the same
semantics. The rows AppKit's generated types describe are the SQL warehouse's
model, shaped by tables someone else owns. The app's model is the domain layer.
Each data need gets one hook in `acl/`, named for the domain concept it returns,
that wraps AppKit's hook and maps rows to domain objects. Only `acl/` imports the
generated types or calls AppKit's data hooks, and only `acl/` calls the app's own
`/api/*` routes. When a table changes shape, one mapping function changes, and
nothing that renders or decides does.

`hooks/` holds the app's other hooks, built on `acl/`: state that several
components share, or a combination of several data needs.

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
ask for every app, internal ones included. Every `async` handler goes through one
small wrapper that passes failures to `next(err)`, because AppKit runs
Express 4, where a rejected promise never reaches the error middleware
([`platform.md`](platform.md) has the details).

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
- The domain layer imports nothing from the view or application layers, React,
  AppKit or browser APIs.
- Only `acl/` imports AppKit's generated types.
- Only `components/charts/` imports AppKit's chart components.
- Nothing imports a server-rendering framework (`next`, `@react-router/dev`,
  `@tanstack/react-start`).
- No import cycles, and no module that nothing imports.

Lint rules on `domain/` enforce the rest of that layer's rules: immutable data
(`eslint-plugin-functional`'s immutability rules), no setters, no agent-noun
class names, one class per file, and exhaustive `switch` statements. Other rules
check single files across the client: no `fetch` inside `useEffect`, no `/api/*`
call outside `acl/`, and an error element on every route.
[tooling.md](tooling.md) lists every tool and why it was chosen.

## Exceptions in AppKit's own files

A few files that came from AppKit's template needed a place in the layers, or
an exception to them:

- `client/src/components/ErrorBoundary.tsx` is a class component, the one in the
  view layer, because React has no hook that catches render errors.
- `client/src/acl/fetch-or-throw.ts` is the helper AppKit's pages use to call
  the server. It calls `fetch`, so it lives in `acl/`, the one layer allowed to.
- `client/src/lib/` holds `utils.ts`, with the `cn` helper that combines
  Tailwind class names for AppKit's UI components. It sits outside the layers.
- `client/src/design/` holds AppKit's development-only design pages, also
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
   it), the lint rules scoped to `domain/`, and the folders mutation testing
   covers.
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

Until the question is answered, the client has only the layers above, and a new
top-level folder under `client/src/` fails the build with a message pointing at
the question.

## Libraries for client concerns

- **Server state:** TanStack Query, for the app's own endpoints. Most state
  libraries are built for client state, not for data that lives on a server and
  goes stale. One `QueryClient` and its provider sit at the app's root, and
  query and mutation options live in `acl/`. Details in
  [data-loading.md](data-loading.md).
- **Shared client state:** React Context, and no store library. Passing data
  deep into the tree is what
  [`useContext`](https://react.dev/reference/react/useContext) is for, and
  nothing yet needs more.
- **Routing:** React Router 7 in data mode (`createBrowserRouter`), as AppKit's
  template ships it. Every route has an `errorElement`.
- **Errors:** `ErrorBoundary.tsx` at the root, plus each route's error element.
  No error library.
- **Forms:** React Hook Form with Zod (`react-hook-form`,
  `@hookform/resolvers`), reusing the Zod schemas the server validates with. It
  is installed with the first form, not before, because knip fails the build on
  an unused dependency. A check fails on a plain `<form>` whose component doesn't
  use it, so the first form can't be built another way. React Router's `<Form>`
  stays allowed for actions with no validation in the browser.

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
