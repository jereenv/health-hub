// ESLint flat config (ESLint 9). Extends Expo's shared config and disables
// stylistic rules that Prettier owns, so lint focuses on correctness only.
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  eslintConfigPrettier,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      'coverage/*',
      'assets/*',
      'babel.config.js',
      'metro.config.js',
      'app.config.js',
    ],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Scripts are console programs; logging is their whole point.
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // UI rules from docs/design/ui-guidelines.md: sheets, skeletons and theme tokens only.
    files: ['app/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    ignores: ['src/ui/theme/tokens.ts', 'src/ui/theme/tokens.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Alert', 'ActivityIndicator', 'Modal'],
              message:
                'Use a bottom sheet instead of Alert or Modal, and a Skeleton instead of ActivityIndicator. See docs/design/ui-guidelines.md.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'Take colours from src/ui/theme/tokens.ts, not hex literals.',
        },
      ],
    },
  },
];
