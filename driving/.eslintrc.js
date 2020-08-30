const prettierConfig = require('./prettier.config');

module.exports = {
  parser: 'babel-eslint',
  plugins: ['prettier', 'import'],
  extends: ['eslint:recommended', 'prettier'],
  env: { browser: true, node: true, es6: true },
  parserOptions: { ecmaVersion: 6 },
  rules: {
    'prettier/prettier': ['warn', prettierConfig],
    eqeqeq: 'warn',
    'guard-for-in': 'error',
    'no-console': 'off',
    'no-multiple-empty-lines': ['warn', { max: 1 }],
    'no-duplicate-imports': 'warn',
    'no-shadow': 'error',
    'no-unused-vars': 'warn',
    'no-use-before-define': ['error', 'nofunc'],
    'no-var': 'error',
    'object-shorthand': 'warn',
    'one-var': ['warn', 'never'],
    'prefer-const': 'warn',
    'prefer-template': 'warn',
    'sort-imports': ['warn', { ignoreDeclarationSort: true }],
    'spaced-comment': 'warn',
    'import/first': 'warn',
    'import/newline-after-import': 'warn',
    'import/order': [
      'warn',
      {
        'newlines-between': 'always',
        groups: ['builtin', ['external', 'internal'], 'parent', 'sibling', 'index'],
        pathGroups: [{ pattern: '{uikit,uikit/**}', group: 'external', position: 'before' }],
        pathGroupsExcludedImportTypes: ['uikit'],
        alphabetize: { order: 'asc', caseInsensitive: false },
      },
    ],
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint', 'prettier', 'import'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier/@typescript-eslint',
      ],
      parserOptions: { ecmaVersion: 6, sourceType: 'module' },
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      },
    },
  ],
};
