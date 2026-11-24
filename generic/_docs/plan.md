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

These packages will be published on npm. Each closes a gap in the gate that is
open today; add each to `pnpm run check` as soon as it is published, and update
`docs/design/tooling.md` and `AGENTS.md` in the same commit.

- [ ] **`lint-ledger`:** one ledger file per kind of escape hatch, each entry a
      file, a line or lines, and a reason that says why the exception can't be
      avoided. Its enforcer fails on any unlisted escape hatch and on any entry that
      no longer matches, so fixed debt has to leave the ledger. Point it at
      lint-disable comments, `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck`;
      coverage and mutation exclusions (`v8 ignore`, `c8 ignore`,
      `istanbul ignore`, `Stryker disable`); skipped and focused tests (`.skip`,
      `.only`, `.todo`, `.fixme`, `xit`, `xdescribe`, and the `@skip`, `@only`,
      `@fixme` and `@wip` tags in feature files); other tools' suppressions
      (`ast-grep-ignore`, `prettier-ignore`, `jscpd:ignore`, sqlfluff's `noqa`);
      and every ignore or exclude list in the configurations of knip, jscpd,
      dependency-cruiser, coverage and Stryker, including each browser-tested folder
      left out of mutation testing. Run it in `pnpm run lint`.
- [ ] **`cross-lint`, with its `nudge`, `appkit` and `agents` plugins:** rules
      about how files relate to one another, with a debt file for violations that
      already exist. Turn on:
  - every query file in `config/queries/` is used by a data hook or a chart or
    table component;
  - every page in `client/src/pages/` has a page-level scenario;
  - every relative link in a Markdown file resolves;
  - every `SKILL.md` meets the Agent Skills specification's rules for `name`
    and `description`;
  - the index in `docs/decisions/` lists exactly the records in that folder, and
    nothing cites a record number that doesn't exist;
  - every `AGENTS.md` has a `CLAUDE.md` beside it that imports it.

  Move the project's own checks in `tools/triggers/` (the Lakebase,
  on-behalf-of-user, write-route and client-layout checks) into the matching
  plugins where they fit, keeping their messages.

- [ ] **`typescript-quality`:** use its domain-layer ESLint configuration for
      the immutability and object-oriented rules on `client/src/domain/`, in place
      of the project's own, and compare `AGENTS.md` with its template.
