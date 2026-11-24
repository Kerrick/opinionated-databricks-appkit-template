# Testing

How behavior is specified, at which level each rule is tested, and the tools
that run each level. The gates that run the tests are in
[tooling.md](tooling.md).

## From a conversation to a scenario

Work on a story starts with the team, before any code, in an
[Example Mapping](https://cucumber.io/blog/bdd/example-mapping-introduction/)
session: the story's rules, a few concrete examples of each, and the questions
nobody can answer yet. The examples become scenarios, written in Gherkin in the
business's own words: declarative, one behavior each, saying what someone
achieves rather than which controls they use.

```gherkin
# Wrong: a script of clicks that breaks when the page changes, and says nothing
# about the rule.
When I click "Filter"
And I select "Overdue" from "Status"
And I click "Apply"

# Right: the behavior, in the business's words.
When Dana looks only at overdue invoices
```

Then the work goes outside in, test first: the scenario fails, then a test at
the cheapest level that proves each rule fails, then the code makes it pass.

### Gherkin by default, TypeScript if nobody outside engineering reads it

Scenarios are Gherkin `.feature` files by default. Gherkin is worth its cost
only when people outside engineering read and help write the scenarios; as
_BDD in Action_ (John Ferguson Smart and Jan Molak, Manning, 2023) puts it,
Cucumber is a collaboration and documentation tool, not a test-scripting tool.
Whether they will is an open question (`docs/open-questions.md`); until it is
answered, scenarios stay in Gherkin, in the words the Example Mapping session
produced.

Switching to TypeScript is cheap, because the step definitions are thin and call
shared tasks (see [Shared tasks](#shared-tasks)). To switch, write each page's scenarios as a
`*.browser.test.tsx` file that calls the same tasks (the page-level project
already runs files with that name), write the journeys as Playwright test files
and point `playwright.config.ts` and `playwright.smoke.config.ts` at them, then
remove QuickPickle, playwright-bdd, the `.feature` files and the step
definitions, and update this document.

## The levels

| Level                         | Proves                                                                                                       | Runs in                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Page level, most of the suite | What one page presents in each situation, how it presents it, and rules that only that screen has            | Vitest Browser Mode, network faked                 |
| Below the UI                  | Every other case of a rule the page level showed a few of: domain objects, mapping in `acl/`, property tests | Vitest in Node                                     |
| Journeys, few                 | The key paths a user takes through the built app                                                             | Playwright, Databricks faked                       |
| Smoke, very few               | That the deployed app really runs on Databricks                                                              | Playwright, against a deployed app, after a deploy |

Test each rule at the cheapest level that proves it. A browser is needed to
check what a screen presents, how it renders it, and rules that belong to one
screen, but once a page shows that an invalid value gets an error message, the
other invalid values are cheaper to test below the UI. Journeys should be a very
small share of the scenarios. (_BDD in Action_, chapters 10 and 13, makes the
same division.)

How much lives below the UI depends on the app. An app that owns its domain has
many rules of its own; a view over data that others own has few.

## What the template's tests cover

The template ships tests for what every generated project has: AppKit's home
page, the not-found page, the route error page, the error boundary that catches
a page that crashes while it renders, and the app's navigation on a wide screen
and on a phone. Choosing the Lakebase, Genie or design plugin adds scenarios for
the page that plugin brings.

There is no example analytics query, page or test. AppKit generates a query's
types from a real SQL warehouse, and no dataset exists in every workspace, so
any example query would fail somewhere. The first vertical slice in the
[plan](../plan.md) adds the first one.

## Page level: Vitest Browser Mode

Page-level scenarios render one page, with its route, in a real browser through
[Vitest Browser Mode](https://vitest.dev/guide/browser/) (`@vitest/browser`,
`@vitest/browser-playwright` and `vitest-browser-react`). A simulated DOM differs
from a real browser in ways that pass tests and fail users; Browser Mode costs
little more and removes the doubt.

- `.feature` files live in `features/pages/`, in a folder named like the page's
  folder in `client/src/pages/` (`home/HomePage.feature`), plus `app/` for the
  app's shell and error boundary and `route-error/` for the route error page.
  [QuickPickle](https://github.com/dnotes/quickpickle) runs them in Vitest, with
  the step definitions in `features/steps/pages.steps.tsx`. A plugin's scenarios
  and steps exist only when that plugin is selected.
- Find elements the way users do, with Testing Library's queries through
  Vitest's locators (`page.getByRole`, `getByLabelText` and the rest), in
  Testing Library's priority order: role first, test IDs never. A test that
  resembles how the software is used gives more confidence
  ([Testing Library's guiding principles](https://testing-library.com/docs/guiding-principles)).
- Click and type with `userEvent` from `vitest/browser`. It sends the input
  through the browser itself; `@testing-library/user-event` only dispatches
  DOM events that imitate it.
- Scenarios check the page with `axe-core` (see
  [Accessibility checks](#accessibility-checks)).

Charts are drawn on a canvas, so a test finds one with
`getByRole('img', { name: ... })` (the label ECharts' accessibility support
gives it) and checks the rows themselves below the UI.

## Faking the network: MSW

[MSW](https://mswjs.io/docs) fakes every `/api/*` request, from one set of
handlers in `features/mocks/fakes.ts`. The page-level tests run them in a
service worker, and journeys through MSW's Playwright binding,
`@msw/playwright`. A request no handler answers gets a 501, and the test fails
when it ends. MSW 3 exports `http` and `HttpResponse` from `msw/http`.

To fake one of AppKit's analytics hooks, answer a `POST` to
`/api/analytics/query/<key>` with an `http.post` handler whose response is a
`text/event-stream` body. The hooks read that stream from a `fetch` response;
they never open an `EventSource`, so MSW's `sse` handlers don't apply.

## Below the UI: Vitest in Node

Domain objects, mapping functions in `acl/`, and `server/` are tested in Node.
Rules that hold across many inputs get property tests with
[fast-check](https://fast-check.dev) and `@fast-check/vitest`. Server plugins
and routes are tested with `@databricks/appkit/testing`, which needs no
workspace and no network.

Don't test static `.sql` files or generated types: there is no behavior in them
to test.

## Journeys: Playwright

A few key journeys run through the built app with
[Playwright](https://playwright.dev), from `.feature` files in
`features/journeys/` that [playwright-bdd](https://vitalets.github.io/playwright-bdd/)
turns into ordinary Playwright tests, written to `.features-gen/` and named
after the feature files. `pnpm run test:e2e` runs them after `pnpm run build`,
and `check` runs it in that order. Journeys check pages with
`@axe-core/playwright`.

### What a journey runs against

`playwright.config.ts` starts AppKit's own server
(`features/mocks/journey-server.ts`), serving the built client, so the real
server code runs:

- **No project plugins.** The server starts with AppKit's `server()` plugin
  alone. The project's plugins need resources that only a deployment binds (a
  warehouse, a database, a volume), so each plugin's routes are tested where
  they live, with AppKit's testing kit, below the UI.
- **Databricks faked inside the server process.** AppKit's server signs in to a
  workspace when it starts. A preload, `features/mocks/fake-databricks.ts`,
  answers those calls with MSW's Node interceptor, inside the server's own
  process, and fails any call it has no handler for, so a journey can never
  reach a real workspace.
- **Plugin routes faked in the browser.** What the browser asks `/api/` for is
  answered by the same handlers the page-level tests use
  (`features/mocks/fakes.ts`), through MSW's Playwright binding,
  `@msw/playwright`. A request nobody faked fails the journey.

AppKit's testing kit can't stand in for the workspace here: it is built on
Vitest's `vi` mocks, so it runs only inside a Vitest test, and Playwright starts
the server as a process of its own. Faked journeys need no credentials, so they
run in the git hook and in CI like the rest of `check`.

Each copy of a project picks its own journey port from where it sits on disk,
so two checkouts or worktrees on one machine can run their journeys at once.
`JOURNEY_PORT` overrides it.

Journeys find elements the way page-level tests do, by role, label or text.
ESLint holds them to it with two rules from `eslint-plugin-playwright`,
`no-raw-locators` and `prefer-native-locators`.

## The browser on Linux, without root

Page-level tests and journeys both drive Playwright's Chromium. On macOS and
Windows the browser Playwright downloads is self-contained. On Linux it links
against shared libraries the system is expected to provide: NSS, GLib, ATK,
D-Bus, ALSA, libgbm, libudev, libxkbcommon and a handful of X11 libraries. A
desktop usually has them; a container, a minimal server or a fresh CI image
often doesn't, and the browser then fails to start with "error while loading
shared libraries" (exit 127).

Playwright's own answer, `playwright install-deps` (or `install --with-deps`),
runs the system package manager, which needs root. It also knows only Debian
and Ubuntu package names. The project's setup and checks never need root, on
any system, so the project brings the libraries itself:

- `pixi.toml` lists the conda-forge packages that provide what Playwright's
  Chromium links against beyond glibc (`readelf -d` on its binaries), for
  x86-64 and Arm Linux, each at an exact version. `pixi.lock` pins every
  package, dependencies included, by checksum. Renovate's pixi manager can
  keep both current.
- [pixi](https://pixi.sh), pinned in `mise.toml` for Linux only, installs
  them into `.pixi/` as part of the browser setup that runs before `pnpm test`
  (`tools/install-browsers.ts`). No root and no system package manager, so
  any Linux distribution with glibc works. The setup then asks `ldd` whether
  the browser still lacks anything, and names what it lacks.
- `tools/browser-libraries.ts` hands the folder to the browser alone, on
  `LD_LIBRARY_PATH` in Playwright's `launchOptions.env`: the page-level tests
  get it in `vitest.pages.config.ts`, and the journeys in
  `playwright.config.ts`. Nothing else in the project runs against those
  libraries, and on macOS and Windows the options are empty.

The browser is still Playwright's own build, at the version Playwright
tests; only the libraries under it come from elsewhere. They are the same
upstream libraries a distribution ships, and the same on every Linux
machine, so a check that passes in CI passes on a developer's machine too.

Alternatives considered:

- Downloading the distribution's packages (`apt-get download` and
  `dpkg -x`) needs no root, but works only where those packages fit: Debian
  and Ubuntu, one release at a time. Nothing would keep the versions current.
- A Chromium build that bundles its libraries (such as `@sparticuz/chromium`,
  made for AWS Lambda) ships only for x86-64 on npm, and trails the Chromium
  that Playwright's release supports.
- Playwright's container image, with the tests connecting to a browser
  server inside it, needs Podman or Docker on every Linux machine, a large
  image, and tests that reach the app through a host name other than
  `localhost`.
- A simulated DOM (jsdom, happy-dom) would let the page-level tests skip the
  browser, but not the journeys, and it differs from a real browser in ways
  that pass tests and fail users.
- mise's own conda-forge support installs each package into a separate
  folder, solved apart from the others, so the libraries could disagree on
  versions; pixi solves them as one set and locks it.

## Smoke journeys

Journeys tagged `@smoke` also run against a deployed app, with nothing faked,
through `pnpm run test:smoke` and `playwright.smoke.config.ts`. playwright-bdd
generates them into `.features-gen/smoke/`, named after their feature files.
The template tags one scenario, "A visitor reaches the running app" in
`features/journeys/finding-the-way-back.feature`: it opens the home page and
expects the welcome heading.

The run needs `APP_URL`, the deployed app's address, and stops with a plain
message without it. When the app sits behind Databricks sign-in, `APP_TOKEN`
supplies a bearer token. That is the only place workspace credentials are
needed, so it is the only test run outside `check`. Who runs it, and how CI
would sign in, are open questions (`docs/open-questions.md`).

## Shared tasks

A step definition does one thing: it calls a task, a method named for what the
visitor wants to get done, such as `opensTheHomePage` or
`isToldThePageWasNotFound`. The tasks are the methods of `Visitor` in
`features/tasks/visitor.ts`, and two classes carry them out: one renders pages
in the test browser (`features/tasks/in-browser.tsx`), and one drives the built
app over HTTP (`features/tasks/through-playwright.ts`). Page-level and journey
steps call the same tasks.

So a scenario says what the visitor achieves, and only the task knows how. A
task can move from the UI to an API, or from a faked backend to a real one, and
no scenario has to change.

## Fakes and stand-ins

A fake is the last resort. When something can run locally the way it runs in
production, test against that instead: if the app adopts Lakebase, its routes
are tested against a local Postgres. Nothing runs a SQL warehouse locally, so
the warehouse is faked.

## Tests that prove something

A test must check specific behavior; "it doesn't crash" is never enough.

- **Coverage is 100%, per file** (`@vitest/coverage-v8` with
  `thresholds: { 100: true, perFile: true }`), and `pnpm test` measures it on
  every run. Every file under `client/src/` and `server/` counts, including
  files no test loads. Mutation testing would catch uncovered code too, since an
  uncovered mutant survives, but coverage says so in seconds instead of minutes.
  `vitest.config.ts` leaves out three files and folders, each with its reason
  beside it: `client/src/main.tsx` and `server/server.ts`, which only start the
  app and which the journeys run, and the Lakebase sample's routes in
  `server/routes/lakebase/`, which run SQL that only a real Postgres can test.
- **Mutation testing at 100%,** with Stryker (`@stryker-mutator/core`, its Vitest
  runner and its TypeScript checker), incrementally, through
  `pnpm run test:mutation`. A mutant that survives is a change to the code that
  no test noticed. Stryker's Vitest runner doesn't support Browser Mode, so
  mutation testing covers the code whose tests run in Node: `client/src/lib/`,
  `client/src/acl/` apart from its `use*` hooks (which are tested in a browser),
  and `client/src/domain/`. The server is left out, because its tests boot an
  AppKit app, which crashes the runner Stryker uses, so no mutant there could be
  judged.

## Accessibility checks

Scenarios at both browser levels check the page they are on with axe
(`axe-core` in the page-level tests, `@axe-core/playwright` in journeys),
against WCAG 2.0, 2.1 and 2.2 at levels A and AA
(`accessibilityTags` in `features/tasks/visitor.ts`). Automated checks find only
some problems, such as missing or invalid properties; they are a floor, not a
substitute for testing with assistive technology.

Each check judges the page at rest. It waits until no animation or transition is
running, since a color that is still changing can't be judged, and in journeys
it first moves the pointer to the corner of the page, away from whatever it last
clicked. So the checks see only the resting state: the colors of a hovered link
or a pressed button are never checked, and contrast in those states is left to
review.
