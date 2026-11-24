# pnpm 11.0.8: a second install leaves out packages `@databricks/appkit` bundles

Draft for the pnpm or AppKit maintainers. Not filed, and not ready to file: the
problem does not reproduce outside this template, and its cause is unknown.

## What the template saw

With pnpm 11.0.8, a second install of a generated project from a warm store left
out the packages that `@databricks/appkit` bundles (`@databricks/sdk-statementexecution`
among them). Importing `@databricks/appkit` then threw "Cannot find package
'@databricks/sdk-statementexecution'". The first, cold install was fine.
Setting `sideEffectsCache: false` fixed the second install; `--package-import-method=copy`
did not.

## Attempt at a minimal reproduction

A fresh folder depending only on `@databricks/appkit` 0.103.0 (the version the
template pins), with the side-effects cache on, installed twice against one
store, then an import. Node 22.23.5, pnpm 11.0.8, Linux x64:

`package.json`:

```json
{ "name": "repro", "private": true, "type": "module",
  "dependencies": { "@databricks/appkit": "0.103.0" } }
```

`pnpm-workspace.yaml`, in two variants. The first:

```yaml
sideEffectsCache: true
```

The second adds the build permissions the template's `pnpm-workspace.yaml`
gives:

```yaml
sideEffectsCache: true
allowBuilds:
  "@databricks/appkit": true
  "@ast-grep/napi": true
```

For each variant, twice in a row, with `node_modules` deleted before each
install and the same `--store-dir` for both:

```sh
rm -rf node_modules
pnpm install --store-dir ../store
node -e "import('@databricks/appkit').then(() => console.log('import ok'), (e) => console.log('import failed:', e.message))"
```

## What it showed

Both variants, both installs:

- The import printed `import ok`.
- `@databricks/sdk-genie`, `sdk-statementexecution` and `sdk-vectorsearch` were
  present under the package's own `node_modules/@databricks`.
- In the first variant, the first install reported "reused 0, downloaded 349"
  and the second "reused 344, downloaded 0", so the second came from the warm
  store. With `allowBuilds` set, both installs ran `@databricks/appkit`'s
  postinstall ("postinstall: Done").
- Both installs ended with `ERR_PNPM_IGNORED_BUILDS` for `protobufjs` (and for
  `@databricks/appkit` in the first variant), which is pnpm's reminder that a build was
  not allowed, not a failure of the import.

So the failure does **not** reproduce with `@databricks/appkit` alone on Linux
x64. What the template has that this folder lacks was not isolated: its other
dependencies, its `overrides` (a `rolldown-vite` alias among them), its
lockfile, and whichever operating system and store state it failed on. The
original failure was seen during `pnpm run test` in a generated project, and
the store it came from was not kept.

## What this template does meanwhile

`generic/pnpm-workspace.yaml` sets `sideEffectsCache: false`, with a comment
describing the failure.

Do not remove it on the strength of this draft. To decide whether it is still
needed, remove the setting in a scratch copy of a generated project, install it
twice against one store, and run `pnpm run test`. If that passes, delete the
setting and its comment, and the paragraph about it in [README.md](README.md).
If it fails, the failing project is the minimal reproduction to reduce, and this
draft should be rewritten from what that run shows.
