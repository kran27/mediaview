import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    linterOptions: {
      reportUnusedDisableDirectives: 'warn'
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    }
  }
];
