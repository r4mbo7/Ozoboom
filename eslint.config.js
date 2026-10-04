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

const forbiddenOutsideLayers = (layers) =>
  layers.flatMap((layer) => [`**/${layer}`, `**/${layer}/**`]);

export default defineConfig(
  globalIgnores(['dist', 'coverage', '.claude']),
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
    files: ['src/sim/**', 'src/data/**', 'src/shared/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...hostGlobals,
        { name: 'Date', message: simulationMessage },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: simulationMessage },
      ],
      'no-restricted-imports': [
        'error',
        {
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
          patterns: [
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
          patterns: [
            {
              group: forbiddenOutsideLayers(['sim']),
              message: 'data ne dépend que de shared (docs/architecture.md).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
