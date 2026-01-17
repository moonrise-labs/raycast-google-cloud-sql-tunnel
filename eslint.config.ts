import jsPlugin from '@eslint/js';
import jsonPlugin from '@eslint/json';
import markdownPlugin from '@eslint/markdown';
import importPlugin from 'eslint-plugin-import';
import prettierPluginRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import typescriptPlugin from 'typescript-eslint';

const sourceFiles = ['src/**/*.{ts,tsx}'];

const typeCheckedConfigs = typescriptPlugin.configs.strict.map((config) => ({
  ...config,
  files: sourceFiles,
}));

const stylisticTypeCheckedConfigs = typescriptPlugin.configs.stylistic.map((config) => ({
  ...config,
  files: sourceFiles,
}));

export default [
  {
    ignores: [
      '**/.bun-tmp/**',
      '**/.coverage/**',
      'coverage/**',
      '**/coverage/**',
      'dist/**',
      '**/dist/**',
      'node_modules/**',
      '**/node_modules/**',
      'raycast-env.d.ts',
    ],
  },

  jsPlugin.configs.recommended,
  ...typescriptPlugin.configs.strict,
  ...typeCheckedConfigs,
  ...stylisticTypeCheckedConfigs,
  ...markdownPlugin.configs.recommended,
  prettierPluginRecommended,

  {
    plugins: {
      json: jsonPlugin,
    },
  },

  // Fix no-irregular-whitespace for non-JS files
  {
    files: ['**/*.json', '**/*.jsonc', '**/*.json5', '**/*.md'],
    rules: {
      'no-irregular-whitespace': 'off',
    },
  },

  // JavaScript + TypeScript
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            {
              pattern: '~/**',
              group: 'internal',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
        },
      ],
      'no-unused-vars': 'off',
      'sort-imports': [
        'error',
        {
          ignoreDeclarationSort: true,
          ignoreCase: true,
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          vars: 'all',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // JavaScript
  {
    files: ['**/*.{cjs,js,mjs}'],
    rules: {},
  },

  // TypeScript
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: true,
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/unified-signatures': 'off',
    },
  },

  // TypeScript tests: allow `import()` type annotations for module mocks.
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: false,
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
    },
  },

  // JSON
  {
    files: ['**/*.json'],
    language: 'json/json',
    ...jsonPlugin.configs.recommended,
  },

  // JSONC
  {
    files: ['**/*.jsonc', '.vscode/*.json'],
    language: 'json/jsonc',
    ...jsonPlugin.configs.recommended,
  },

  // JSON5
  {
    files: ['**/*.json5'],
    language: 'json/json5',
    ...jsonPlugin.configs.recommended,
  },

  // Markdown
  {
    files: ['**/*.md'],
    rules: {
      'markdown/no-missing-label-refs': 'off',
      'prettier/prettier': 'off',
    },
  },
];
