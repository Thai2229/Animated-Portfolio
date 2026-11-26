// Not using eslint-config-next: it loads typescript-eslint, which does not support the pinned TypeScript 7.
// Types are checked by `tsc`; ESLint parses TS with Babel and applies the Next, React Hooks and a11y rules.
import js from '@eslint/js';
import babelParser from '@babel/eslint-parser';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  { ignores: ['.next/**', 'out/**', 'next-env.d.ts', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { parserOpts: { plugins: ['typescript', 'jsx'] } },
      },
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', self: 'readonly', console: 'readonly',
        performance: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        Worker: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', ImageData: 'readonly',
        MessageEvent: 'readonly', KeyboardEvent: 'readonly', HTMLElement: 'readonly', Transferable: 'readonly',
        Uint8ClampedArray: 'readonly', React: 'readonly', process: 'readonly',
      },
    },
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
