# Plan

The work ahead, in order. Tick an item off in the same commit as the work that
finishes it, and add items as the project learns what it needs.

## Before the first feature

- [ ] **Answer the [open questions](open-questions.md).** Each answer moves to
      its home and changes what it changes, and its question is deleted. The rest of
      this plan assumes the answers about data, writes and identity.
- [ ] **Write the `answer-open-question` skill** in `.agents/skills/`, with the
      `skill-authoring` skill, right after answering the first question, from what
      that answer actually took: where the answer went, which documents and records
      changed, and how the question left the list.

## The first slice

- [ ] **Build one vertical slice by test-driven development,** once the data the
      app reads is known. Start with an Example Mapping session for one story, then
      its page-level scenario (and a journey, if the story is one), then the page, a
      hook in `client/src/acl/` over one analytics query, the domain object it
      returns, and the components that show it.
- [ ] **Write the `add-analytics-query` skill** from that slice: the SQL file,
      its generated types, the anti-corruption hook, the domain object, and their
      tests.
- [ ] **Write the `add-custom-endpoint` skill** after building the first custom
      endpoint: the error-forwarding wrapper, input validation with Zod, the route's
      test, and the network fake that page-level tests use for it.
- [ ] **Deploy to the development workspace.** Confirm that `app.yaml` still
      declares the health check on `/health` and that the deploy waits for it to
      pass. Then write the `deploy-to-workspace` skill from what the deploy took.

## Wire in once published

Three packages that close gaps in the gate are due on npm. As each is
published, add it to `pnpm run check`, and update `docs/design/tooling.md` and
`AGENTS.md` in the same commit.

- [ ] **`lint-ledger`:** a written record of every exception to a rule. It keeps
      one file for each kind of exception, and an entry names the file, the lines
      and the reason the exception can't be avoided. The check fails on an
      exception the record doesn't list, and on an entry whose exception has gone,
      so a fixed problem leaves the record too. Run it in `pnpm run lint`, over
      every kind of exception the project's tools accept:
  - comments that switch a check off: lint disables, `@ts-ignore`,
    `@ts-expect-error`, `@ts-nocheck`, `ast-grep-ignore`, `prettier-ignore`,
    `jscpd:ignore` and sqlfluff's `noqa`;
  - comments that hide code from coverage or mutation testing: `v8 ignore`,
    `c8 ignore`, `istanbul ignore` and `Stryker disable`;
  - tests that don't run, or run alone: `.skip`, `.only`, `.todo`, `.fixme`,
    `xit` and `xdescribe` in test files, and `@skip`, `@only`, `@fixme` and
    `@wip` on scenarios;
  - the lists of files and packages each tool is told to leave alone, in the
    configurations of knip, jscpd, dependency-cruiser, coverage and Stryker.

  Until it is wired in, this list is the record of the exceptions the template
  ships, and the ledger starts from it:
  - the `Stryker disable` comment in `client/src/acl/fetch-or-throw.ts`, on a
    mutant that behaves exactly like the original: a body that isn't JSON and a
    missing body both fail the schema;
  - Stryker's `mutate` list, which leaves out `server/**` (its tests boot an
    AppKit app, which crashes the runner Stryker uses) and
    `client/src/acl/use*.ts` (hooks, whose tests run in a browser, where Stryker
    can't);
  - coverage's `exclude` list in `vitest.config.ts`, which leaves out
    `server/routes/lakebase/**` (the Lakebase sample's routes run SQL, which
    only a real Postgres can test), and `client/src/main.tsx` and
    `server/server.ts` (they only start the app, and the journeys run them);
  - knip's `ignoreDependencies`, for four packages that are used where knip
    can't see: `@ast-grep/napi`, which `appkit lint` loads, the two PostCSS
    packages, and `tw-animate-css`, which AppKit's stylesheet imports.

- [ ] **`cross-lint`, with its `nudge`, `appkit` and `agents` plugins:** checks
      that look at how files relate to one another, where today's linters see one
      file at a time. Violations that already exist go in a debt file, so the
      check can start strict. Turn on:
  - each query file in `config/queries/` is used by a data hook, or by a chart
    or table component;
  - each page in `client/src/pages/` has page-level scenarios;
  - each relative link in a Markdown file leads somewhere;
  - each `SKILL.md` has a `name` and `description` that follow the Agent Skills
    specification;
  - `docs/decisions/README.md` lists every record in its folder and nothing
    else, and no file cites a record number that isn't there;
  - each `AGENTS.md` has a `CLAUDE.md` beside it that imports it.

  Then move the project's own checks in `tools/triggers/` (the client layout,
  the write route, Lakebase and on-behalf-of-user queries) into the plugins that
  fit them, keeping their messages.

- [ ] **`typescript-quality`:** a shared baseline for TypeScript projects. Use
      its ESLint configuration for the domain layer, in place of the immutability
      and object rules this project sets up itself for `client/src/domain/`, and
      compare `AGENTS.md` with the template it ships.
