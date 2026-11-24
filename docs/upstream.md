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

`generic/` is no longer identical to `template/`. Each entry names the files and the reason.

- `client/src/ErrorBoundary.tsx` moved to `client/src/components/ErrorBoundary.tsx`, and `client/src/lib/fetch-or-throw.ts` to `client/src/acl/fetch-or-throw.ts`, so that both live in a layer. `main.tsx` and the three pages that import `fetch-or-throw` follow.
- `package.json`, `tsconfig.json` and `tsconfig.tools.json`: a `tools/` project (typechecked with `tsc -b`, run with `tsx`) holding the repository checks, and the `lint:triggers` script that `lint` runs.
- `tools/`: new. Checks that stay quiet until the project learns something: an unknown folder under `client/src/`, a first non-GET custom server route, Lakebase arriving, and an on-behalf-of-user query.
- `tsconfig.shared.json` extends `@tsconfig/strictest` (added to `devDependencies`) and keeps only the module and emit settings. The strictest preset adds `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` and `isolatedModules`, so the `ErrorBoundary` and `example.test.ts` class members gained `override`.
- `package.json`: `typescript` is now an alias of `@typescript/typescript6` 6.0.2 (the compiler API that typescript-eslint, dependency-cruiser and Stryker's checker call), and `@typescript/native` aliases `typescript` 7.0.2, which keeps `tsc` at 7.0. `tsc6` is the 6.0 compiler. AppKit's type generation also imports `typescript`, so it now runs on 6.0.
- `.oxlintrc.json`: added `typescript/switch-exhaustiveness-check`, and `max-classes-per-file` (one class per file) for `client/src/domain/`. `lint:oxlint` runs with `--deny-warnings`.
- `eslint.config.js`: new flat config for what oxlint lacks: `naming-convention` (no agent-noun class names in the domain), disable-comment hygiene, sonarjs, functional's immutability rules and a setter ban in the domain, and JSDoc on exports from the domain and `server/`. The `lint` script now runs oxlint, ESLint and the triggered checks in turn.
- `client/src/App.tsx`, `client/src/components/ErrorBoundary.tsx`, `server/example.test.ts`: small edits so the new rules pass (readonly props, one return type, `static readonly`).
