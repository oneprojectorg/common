export const baseRules = {
  '@typescript-eslint/no-explicit-any': 'warn',
  'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
  'perfectionist/sort-imports': [
    'error',
    {
      type: 'alphabetical',
      order: 'asc',
      ignoreCase: true,
      specialCharacters: 'keep',
      newlinesBetween: 'always',
      groups: [
        'builtin',
        'external',
        'monorepo',
        'internal',
        'parent',
        'sibling',
        'index',
        'object',
        'type',
        'icons',
      ],
      customGroups: {
        value: {
          monorepo: ['^@op/.+'],
          icons: ['^~icons/.+'],
        },
      },
    },
  ],
  '@typescript-eslint/ban-ts-comment': 'warn',
  'no-restricted-syntax': [
    'error',
    {
      selector: 'ImportDeclaration[source.value=/~icons.*[^.jsx]$/]',
      message: 'Imports from ~icons must end with .jsx',
    },
  ],
};
