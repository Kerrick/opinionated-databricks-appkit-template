// Architecture rules, checked on the import graph by `pnpm run lint:boundaries` (tools/check-boundaries.ts).
// Each rule's comment says what it protects; the explanation lives in docs/design/architecture.md.
//
// Paths are matched on the resolved file. pnpm's real paths (node_modules/.pnpm/<name>@<version>/node_modules/<name>)
// contain "/node_modules/<name>/", so one pattern covers both layouts. An import that resolves to nothing is
// matched by its bare name.

/**
 * Matches a package (and anything under it) in node_modules, or an unresolved import of it.
 * @param {string[]} names package names, or patterns for them
 * @returns {string} a pattern for `path`
 */
const packages = (names) => {
  const alternatives = names.join('|');
  return `(^|/)node_modules/(${alternatives})(/|$)|^(${alternatives})(/|$)`;
};

const VIEW = '^client/src/(components|pages)/';
const APPLICATION = '^client/src/(hooks|acl)/';
const DOMAIN = '^client/src/domain/';

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-circular',
      comment:
        'A cycle makes modules impossible to understand or change one at a time. Break it by moving what both need.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment: 'A module nothing imports and that imports nothing is dead code, or a file that is not wired in.',
      severity: 'error',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)[^/]+\\.config\\.[cm]?[jt]s$',
          '(^|/)\\.[^/]+\\.[cm]?[jt]s$',
          '^tools/[^/]+\\.ts$',
          '\\.(test|spec)\\.[cm]?[jt]sx?$',
        ],
      },
      to: {},
    },
    {
      name: 'not-to-unresolvable',
      comment: 'An import that resolves to nothing is a typo, or a dependency missing from package.json.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: packages(['next', '@react-router/dev', '@tanstack/react-start']) },
    },
    {
      name: 'no-server-rendering-frameworks',
      comment:
        'The app is a single-page client served by AppKit. Next.js, React Router framework mode and TanStack Start each want to own the HTTP server and would displace AppKit’s plugins, generated types and deploy checks.',
      severity: 'error',
      from: {},
      to: { path: packages(['next', '@react-router/dev', '@tanstack/react-start']) },
    },
    {
      name: 'client-not-server',
      comment:
        'Client code is bundled for the browser. It must not import server code, which holds secrets and Node APIs.',
      severity: 'error',
      from: { path: '^client/' },
      to: { path: ['^(server|config)/', packages(['@databricks/appkit'])] },
    },
    {
      name: 'server-not-client',
      comment:
        'Server code must not import client code. When both need a rule, move it to shared/ so one copy serves both sides.',
      severity: 'error',
      from: { path: '^(server|shared)/' },
      to: { path: '^client/' },
    },
    {
      name: 'shared-not-app-code',
      comment: 'shared/ holds types, and domain rules once they are shared. It depends on neither side.',
      severity: 'error',
      from: { path: '^shared/', pathNot: '^shared/appkit-types/' },
      to: { path: '^(client|server|config)/' },
    },
    {
      name: 'domain-imports-nothing-above-it',
      comment:
        'The domain layer is plain TypeScript. It must not import views, hooks, the anti-corruption layer or the app shell.',
      severity: 'error',
      from: { path: DOMAIN },
      to: { path: ['^client/src/(components|pages|hooks|acl|lib|design)/', '^client/src/[^/]+\\.(ts|tsx)$'] },
    },
    {
      name: 'domain-not-framework',
      comment: 'The domain layer must not import React, React Router, TanStack Query, AppKit or a chart library.',
      severity: 'error',
      from: { path: DOMAIN },
      to: {
        path: packages([
          'react',
          'react-dom',
          'react-router',
          '@tanstack/react-query',
          '@databricks/[^/]+',
          'echarts',
          'echarts-for-react',
        ]),
      },
    },
    {
      name: 'application-not-view',
      comment: 'Hooks and the anti-corruption layer serve views. They must not import them.',
      severity: 'error',
      from: { path: APPLICATION },
      to: { path: VIEW },
    },
    {
      name: 'acl-not-hooks',
      comment: 'Hooks are built on the anti-corruption layer, so it cannot import them back.',
      severity: 'error',
      from: { path: '^client/src/acl/' },
      to: { path: '^client/src/hooks/' },
    },
    {
      name: 'components-not-pages',
      comment: 'Pages compose components. A component importing a page inverts that.',
      severity: 'error',
      from: { path: '^client/src/components/' },
      to: { path: '^client/src/pages/' },
    },
    {
      name: 'generated-types-only-in-acl',
      comment:
        'AppKit’s generated row types are the warehouse’s model, not ours. Only the anti-corruption layer imports them and maps rows to domain objects.',
      severity: 'error',
      from: { path: '^(client|server)/', pathNot: ['^client/src/acl/', '\\.d\\.ts$'] },
      to: { path: '^shared/appkit-types/' },
    },
    {
      name: 'charts-library-only-in-chart-wrappers',
      comment:
        'Chart libraries are used through the wrappers in components/charts/, which turn on ECharts’ accessibility support once per chart type.',
      severity: 'error',
      from: { path: '^client/', pathNot: '^client/src/components/charts/' },
      to: { path: packages(['echarts', 'echarts-for-react', 'zrender']) },
    },
  ],
  options: {
    doNotFollow: { path: '(^|/)node_modules/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.client.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
