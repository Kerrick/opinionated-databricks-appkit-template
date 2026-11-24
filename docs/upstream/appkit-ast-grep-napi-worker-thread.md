# `@databricks/appkit` 0.103.0 depends on an `@ast-grep/napi` that crashes in a worker thread

Draft for the AppKit maintainers. Not filed.

## Affected versions

- `@databricks/appkit` 0.103.0 depends on `@ast-grep/napi` 0.37.0 (it is
  listed in its `dependencies`). Whether other AppKit versions do was not checked.
- `@ast-grep/napi` 0.37.0 crashes with a segmentation fault (exit code 139)
  when it is loaded in a worker thread on Linux x64, with Node 22.23.5.
- `@ast-grep/napi` 0.51.3 does not.

## Reproduction

In an empty folder, with Node 22.23.5 on Linux x64, for each version `V` in
`0.37.0` and `0.51.3`:

```sh
npm install @ast-grep/napi@V
```

Three lines, in `worker.mjs`:

```js
import { Worker } from 'node:worker_threads';
new Worker("require('@ast-grep/napi')", { eval: true });
```

Then `node worker.mjs; echo "exit $?"`. The two runs printed:

```text
== @ast-grep/napi 0.37.0
Segmentation fault (core dumped)
exit 139
== @ast-grep/napi 0.51.3
exit 0
```

The template also saw the crash when a test run in a worker thread imported
`@databricks/appkit` (importing only its testing kit did not trigger it), and
that is how it was found: Stryker's runner died before it could judge a mutant.

## What this template does meanwhile

`generic/stryker.config.json` sets `vitest.pool` to `forks`, so Stryker's test
runs use child processes instead of worker threads.

Remove that setting, and the sentence about it under "Mutation testing" in
[README.md](README.md), once a release of `@databricks/appkit` depends on an
`@ast-grep/napi` that doesn't crash. Then run `pnpm run test:mutation` in a
generated project to see that it still passes.

Bumping `@ast-grep/napi` in `generic/package.json` alone is not that change:
the pin there matches what `@databricks/appkit` depends on.

## Possible fix

Raise the `@ast-grep/napi` dependency of `@databricks/appkit` to a version that
loads in a worker thread. 0.51.3 does. No patch is attached, because the change
is one version number in AppKit's `package.json`.
