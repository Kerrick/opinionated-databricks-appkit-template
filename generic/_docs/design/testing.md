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

Gherkin is worth its cost only when people outside engineering read and help
write the scenarios; as _BDD in Action_ (John Ferguson Smart and Jan Molak,
Manning, 2023) puts it, Cucumber is a collaboration and documentation tool, not a
test-scripting tool. Whether they will is an open question
(`docs/open-questions.md`). If they won't, scenarios become plain TypeScript
tests beside each page.

## The levels

| Level                         | Proves                                                                                                                 | Runs in                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Page level, most of the suite | What a page shows in different circumstances, how it is shown, and rules specific to one screen                        | Vitest Browser Mode, network faked                               |
| Below the UI                  | The many variations of a rule, once a few are shown on screen: domain objects, anti-corruption mapping, property tests | Vitest in Node                                                   |
| Journeys, few                 | The key paths a user takes through the built app                                                                       | Playwright, Databricks faked                                     |
| Smoke, very few               | That the deployed app really reaches Databricks                                                                        | Playwright, against the development workspace, after each deploy |

Test each rule at the cheapest level that proves it. A browser is needed to
check what a screen presents, how it renders it, and rules that belong to one
screen, but once a page shows that an invalid value gets an error message, the
other invalid values are cheaper to test below the UI. Journeys should be a very
small share of the scenarios. (_BDD in Action_, chapters 10 and 13, makes the
same division.)

How much lives below the UI depends on the app. An app that owns its domain has
many rules of its own; a view over data that others own has few.

## Page level: Vitest Browser Mode

Page-level scenarios render one page, with its route, in a real browser through
[Vitest Browser Mode](https://vitest.dev/guide/browser/) (`@vitest/browser`,
`@vitest/browser-playwright` and `vitest-browser-react`). A simulated DOM differs
from a real browser in ways that pass tests and fail users; Browser Mode costs
little more and removes the doubt.

- `.feature` files live in `features/pages/`, one per page, at the path that
  matches the page in `client/src/pages/`. [QuickPickle](https://github.com/dnotes/quickpickle)
  runs them in Vitest, with the project's own step definitions.
- Find elements the way users do, with Testing Library's queries through
  Vitest's locators (`page.getByRole`, `getByLabelText` and the rest), in
  Testing Library's priority order: role first, test IDs never. A test that
  resembles how the software is used gives more confidence
  ([Testing Library's guiding principles](https://testing-library.com/docs/guiding-principles)).
- Act through `userEvent` from `vitest/browser`, which drives real browser
  input, not `@testing-library/user-event`, which only simulates events.
- Each page-level test also runs `axe-core` against the rendered page.

Charts are drawn on a canvas, so a test finds one with
`getByRole('img', { name: ... })` (the label ECharts' accessibility support
gives it) and checks the rows themselves below the UI.

## Faking the network: MSW

[MSW](https://mswjs.io/docs) is the single source of fakes for `/api/*`: the
same handlers serve page-level tests and, when a journey fakes in the browser,
journeys too, through MSW's own Playwright binding `@msw/playwright`. MSW 3
exports `http` and `HttpResponse` from `msw/http`.

AppKit's analytics hooks don't use `EventSource`. They `POST` to
`/api/analytics/query/<key>` and read a server-sent-event stream from the
response, so their fake is an `http.post` handler that returns a
`text/event-stream` body, not one of MSW's `sse` handlers.

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
turns into ordinary Playwright tests. Each journey also runs
`@axe-core/playwright`.

Databricks is faked at the outermost boundary that needs no workspace, so that
the app's real routes, validation and error handling run: inside the server
process, intercepting its calls to Databricks, where AppKit's test kit allows;
otherwise in the browser, with the MSW handlers. Faked journeys need no
credentials, so they run in the git hook and in CI like the rest.

Locators in journeys follow the same rule as page-level tests;
`eslint-plugin-playwright`'s `no-raw-locators` and `prefer-native-locators`
enforce it there.

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

Journeys tagged `@smoke` also run unfaked, with `pnpm run test:smoke`, against
the deployed development workspace, after each deploy. That is the only place
workspace credentials are needed, so it is the only test run outside `check`.
One of them, at `tests/smoke.spec.ts`, checks that the app loads, which is where
Databricks' own agent skills expect a smoke test.

## Shared tasks

Step definitions stay thin. Each calls a task named for the goal it achieves,
and the page-level steps and the journey steps share the tasks. A task can then
change how it reaches its goal (a faked or a real backend; the UI or an API)
without any scenario changing. Layers of abstraction like this separate what a
scenario specifies from how a test carries it out.

## Fakes and stand-ins

Where a local, production-like stand-in exists, prefer it to a fake. If the app
adopts Lakebase, its tests run against a local Postgres container. A SQL
warehouse has no local stand-in, so it is faked.

## Tests that prove something

A test must check specific behavior; "it doesn't crash" is never enough.

- **Coverage is 100%, per file** (`@vitest/coverage-v8` with
  `thresholds: { 100: true, perFile: true }`). Mutation testing would catch
  uncovered code too, since an uncovered mutant survives, but coverage says so
  in seconds instead of minutes.
- **Mutation testing at 100%,** with Stryker (`@stryker-mutator/core`, its Vitest
  runner and its TypeScript checker), incrementally. A mutant that survives is a
  change to the code that no test noticed. Stryker's Vitest runner doesn't
  support Browser Mode, so mutation testing covers the code whose tests run in
  Node: the domain layer, the mapping functions in `acl/`, and `server/`.
- **Accessibility checks** with axe at both browser levels. Automated checks
  find only some problems, such as missing or invalid properties; they are a
  floor, not a substitute for testing with assistive technology.
