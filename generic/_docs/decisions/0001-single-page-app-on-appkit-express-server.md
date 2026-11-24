---
status: accepted
date: 2026-11-24
deciders: the template's maintainer chose AppKit's own server and rejected server-rendering frameworks
---

# The app is a single-page app on AppKit's Express server

## Context and Problem Statement

A Databricks App can run any web stack the platform can start. AppKit, the Databricks TypeScript SDK, ships its own Express server. That server carries plugins for analytics, files, Lakebase and more. It also carries generated types for the app's SQL queries, data hooks, user-authorization wiring, and the checks `databricks apps deploy` runs. Frameworks that render on the server want to own the HTTP server themselves. Which server and rendering model should every project made from this template start on?

## Decision Drivers

- Keep every AppKit plugin, its generated query types and its data hooks working without glue code.
- Keep the platform's validation before deploys (build, typecheck, lint), which relies on AppKit's project layout.
- Stay on the path Databricks itself supports and documents.

## Considered Options

1. A single-page React app, served by AppKit's Express server.
2. A server-rendering framework that owns the HTTP server: Next.js, React Router in framework mode, or TanStack Start.

## Decision Outcome

Chosen: option 1. AppKit's plugins, types, hooks and deploy checks all assume its own server, and option 2 gives them up. Databricks' agent skills file Next.js under frameworks that aren't AppKit ([databricks-agent-skills, other-frameworks.md](https://github.com/databricks/databricks-agent-skills/blob/5ecd4e16f9fd/skills/databricks-apps/references/other-frameworks.md)). How the client loads data without waterfalls is in `docs/design/data-loading.md`.

Confidence: AppKit's template already runs this way, and the generated project builds and passes its checks. No comparison of runtime performance against option 2 was made.

### Consequences

- Good, because AppKit's plugins and type generation work as Databricks designed them, and its upgrades arrive without porting.
- Bad, because there is no server rendering. The first paint waits for JavaScript, and every page's data loads in the browser.
- Bad, because the project is tied to AppKit's release pace and Express 4. Whoever maintains it must track AppKit's changes and Express 4's error handling for `async` handlers.

### Confirmation

The generated project's `build` type-checks and bundles the server with tsdown, then type-checks and builds the client with Vite. dependency-cruiser's `no-server-rendering-frameworks` rule, part of `check`, fails when any file imports `next`, `@react-router/dev` or `@tanstack/react-start`.

## More Information

Revisit when AppKit supports a server-rendering framework, or when a project's first-paint needs outweigh AppKit's plugins.
