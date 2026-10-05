import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const simulationMessage =
  "La simulation ne connaît ni le navigateur, ni l'horloge, ni le hasard système (ADR 0003).";

const hostGlobals = [
  ...new Set([...Object.keys(globals.browser), ...Object.keys(globals.node)]),
].map((name) => ({ name, message: simulationMessage }));

const peerjsOnly = [
  {
    name: 'peerjs',
    message: "peerjs ne s'importe que dans src/net/peerjs.ts (ADR 0007).",
  },
];

const forbiddenOutsideLayers = (layers) =>
  layers.flatMap((layer) => [`**/${layer}`, `**/${layer}/**`]);

const layersAbove = {
  group: [
    'pixi.js',
    'pixi.js/*',
    ...forbiddenOutsideLayers(['render', 'input', 'audio', 'ui', 'feedback', 'net', 'app']),
  ],
  message: 'Les couches sim, data et shared ne dépendent pas des couches au-dessus (ADR 0003).',
};

export default defineConfig(
  globalIgnores([
    'dist',
    'coverage',
    '.claude',
    'test-results',
    'playwright-report',
    'blob-report',
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: peerjsOnly }],
    },
  },
  {
    files: ['src/sim/**', 'src/data/**', 'src/shared/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...hostGlobals,
        { name: 'Date', message: simulationMessage },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
          message:
            'Le ** n’est pas reproductible d’un moteur à l’autre : multiplier (docs/architecture.md).',
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: simulationMessage },
        ...['sin', 'cos', 'tan', 'atan', 'atan2', 'pow', 'exp', 'log', 'hypot', 'cbrt'].map(
          (property) => ({ object: 'Math', property, message: simulationMessage }),
        ),
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: peerjsOnly,
          patterns: [
            {
              group: [
                'pixi.js',
                'pixi.js/*',
                ...forbiddenOutsideLayers(['render', 'input', 'audio', 'ui', 'net', 'app']),
              ],
              message:
                'Les couches sim, data et shared ne dépendent pas des couches au-dessus (ADR 0003).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**', 'src/feedback/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: peerjsOnly,
          patterns: [
            {
              group: [
                'pixi.js',
                'pixi.js/*',
                ...forbiddenOutsideLayers(['render', 'audio', 'net', 'app']),
              ],
              message:
                "ui et feedback lisent l'état de la sim : ni rendu, ni audio, ni réseau, ni assemblage (docs/architecture.md).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/net/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: peerjsOnly,
          patterns: [
            {
              group: [
                'pixi.js',
                'pixi.js/*',
                ...forbiddenOutsideLayers(['render', 'input', 'audio', 'ui', 'feedback', 'app']),
              ],
              message: 'net ne dépend que de sim, shared et data (docs/architecture.md).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: peerjsOnly,
          patterns: [
            layersAbove,
            {
              group: forbiddenOutsideLayers(['sim', 'data']),
              message: 'shared ne dépend de rien dans src/ (docs/architecture.md).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/data/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: peerjsOnly,
          patterns: [
            layersAbove,
            {
              group: forbiddenOutsideLayers(['sim']),
              message: 'data ne dépend que de shared (docs/architecture.md).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/net/peerjs.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'pixi.js',
                'pixi.js/*',
                ...forbiddenOutsideLayers(['render', 'input', 'audio', 'ui', 'feedback', 'app']),
              ],
              message: 'net ne dépend que de sim, shared et data (docs/architecture.md).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
