module.exports = {
  root: true,

  // Configuration for JavaScript files
  extends: ['airbnb-base', 'plugin:prettier/recommended'],
  rules: {
    'no-param-reassign': [
      'error',
      { props: true, ignorePropertyModificationsForRegex: ['^draft'] }, // draft, draftPost, draftState...
    ],

    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        endOfLine: 'auto',
      },
    ],
  },
  overrides: [
    // Configuration for TypeScript files
    {
      files: ['**/*.ts', '**/*.tsx'],
      plugins: ['@typescript-eslint', 'unused-imports'],
      extends: ['airbnb-typescript', 'plugin:prettier/recommended'],
      parserOptions: {
        tsconfigRootDir: __dirname, // this helps both pnpm lint and lint on save execute properly
        project: './tsconfig.json',
      },
      rules: {
        'react/jsx-filename-extension': [0],
        'prettier/prettier': [
          'error',
          {
            singleQuote: true,
            endOfLine: 'auto',
            printWidth: 120,
          },
        ],
        'no-nested-ternary': 'off',
        '@next/next/no-img-element': 'off', // We currently not using next/image because it isn't supported with SSG mode
        'import/order': [
          'error',
          {
            groups: ['builtin', 'external', 'internal'],
            pathGroups: [
              {
                pattern: 'react',
                group: 'external',
                position: 'before',
              },
            ],
            pathGroupsExcludedImportTypes: ['react'],
            'newlines-between': 'always',
            alphabetize: {
              order: 'asc',
              caseInsensitive: true,
            },
          },
        ], // Follow the same ordering as the official plugin `prettier-plugin-tailwindcss`
        '@typescript-eslint/comma-dangle': 'off', // Avoid conflict rule between Eslint and Prettier
        'import/prefer-default-export': 'off', // Named export is easier to refactor automatically
        '@typescript-eslint/no-unused-vars': 'off',
        'no-param-reassign': [
          'warn',
          { props: true, ignorePropertyModificationsFor: ['req', 'res'] },
        ],
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': [
          'error',
          {
            vars: 'all',
            varsIgnorePattern: '^_',
            args: 'after-used',
            argsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/naming-convention': 'warn',
        'import/no-cycle': 'warn',
      },
    },
  ],
};
