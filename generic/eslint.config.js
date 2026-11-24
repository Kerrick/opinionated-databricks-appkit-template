// ESLint runs second, for what oxlint lacks. Before adding a rule here, check that oxlint doesn't have it,
// and never turn a rule on in both tools: the two would report the same problem twice.
//
// What belongs here:
//  - typescript-eslint's `naming-convention` (no agent-noun class names in the domain layer)
//  - disable-comment hygiene (eslint-plugin-eslint-comments)
//  - complexity and code smells (eslint-plugin-sonarjs)
//  - immutable domain objects (eslint-plugin-functional, domain layer only)
//  - documentation on exports (eslint-plugin-jsdoc, domain layer and server only)
import comments from '@eslint-community/eslint-plugin-eslint-comments';
import functional from 'eslint-plugin-functional';
import jsdoc from 'eslint-plugin-jsdoc';
import playwright from 'eslint-plugin-playwright';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

const sources = ['client/src/**/*.{ts,tsx}', 'server/**/*.ts', 'config/**/*.ts', 'tools/**/*.ts'];
const domain = ['client/src/domain/**/*.{ts,tsx}'];
// The files that drive the built app in Playwright. Elsewhere in the tests, Testing Library's query rules
// apply through the page-level tasks; here these rules keep locators to what a person sees.
const journeys = ['features/steps/journeys.steps.ts', 'features/tasks/through-playwright.ts'];
const tests = ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'];

// Names that describe what an object does for others instead of what it is. A domain class names the concept.
const AGENT_NOUNS = [
  'Manager',
  'Handler',
  'Controller',
  'Processor',
  'Helper',
  'Util',
  'Utils',
  'Service',
  'Coordinator',
  'Orchestrator',
  'Executor',
  'Dispatcher',
  'Worker',
  'Operator',
  'Builder',
  'Factory',
  'Provider',
  'Wrapper',
  'Validator',
  'Mapper',
  'Resolver',
  'Parser',
  'Loader',
  'Runner',
].join('|');

// sonarjs rules whose job oxlint already does under another name. One tool per rule.
const OVERLAPS_WITH_OXLINT = [
  'block-scoped-var',
  'deprecation',
  'no-array-delete',
  'no-control-regex',
  'no-delete-var',
  'no-empty-character-class',
  'no-fallthrough',
  'no-invalid-regexp',
  'no-labels',
  'no-misleading-character-class',
  'no-regex-spaces',
  'no-unused-vars',
  'no-useless-catch',
  'prefer-regexp-exec',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.databricks/**',
      '**/.stryker-tmp/**',
      '**/.pixi/**',
      '**/.features-gen/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/reports/**',
      // Written by `appkit generate-types`; edits are overwritten on the next run
      'shared/appkit-types/**',
    ],
  },
  {
    files: sources,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { '@eslint-community/eslint-comments': comments, sonarjs },
    rules: {
      ...comments.configs.recommended.rules,
      '@eslint-community/eslint-comments/require-description': 'error',
      ...sonarjs.configs.recommended.rules,
      ...Object.fromEntries(OVERLAPS_WITH_OXLINT.map((name) => [`sonarjs/${name}`, 'off'])),
    },
  },
  {
    // Tests assert through helpers (expectStream, page-level tasks, step definitions) as often as through
    // expect(), and this rule can't see inside a helper. Mutation testing is what shows a test that asserts nothing.
    files: tests,
    rules: { 'sonarjs/assertions-in-tests': 'off' },
  },
  {
    files: domain,
    ignores: tests,
    plugins: { '@typescript-eslint': tseslint.plugin, functional },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'class',
          format: null,
          custom: { regex: `(${AGENT_NOUNS})$`, match: false },
        },
      ],
      'functional/immutable-data': 'error',
      'functional/no-let': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MethodDefinition[kind="set"]',
          message:
            'Domain objects are immutable: no setters. Return a new instance from a method such as withStatus(status).',
        },
      ],
    },
  },
  {
    files: [...domain, 'server/**/*.ts'],
    ignores: tests,
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration'],
        },
      ],
    },
  },
  {
    ...playwright.configs['flat/recommended'],
    files: journeys,
    languageOptions: { parser: tseslint.parser },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Find elements by role, label or text, as a person would; test IDs, CSS and XPath are for when nothing else works.
      'playwright/no-raw-locators': 'error',
      'playwright/prefer-native-locators': 'error',
    },
  }
);
