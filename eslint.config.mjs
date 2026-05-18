import js from '@eslint/js';
import globals from 'globals';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  // Directorios a ignorar
  {
    ignores: ['node_modules/**', 'release/**', 'dist/**'],
  },

  // Reglas base recomendadas para todos los archivos JS
  js.configs.recommended,

  // Integración con Prettier (desactiva reglas de estilo conflictivas y aplica prettier/prettier)
  eslintPluginPrettierRecommended,

  // Proceso principal y preload: entorno Node.js / CommonJS
  {
    files: ['main.js', 'preload.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },

  // Proceso renderer: entorno browser (sin acceso a Node)
  {
    files: ['renderer.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        L: 'readonly',
        localforage: 'readonly',
      },
    },
  },

  // Reglas personalizadas aplicadas a todos los archivos JS
  {
    files: ['**/*.js'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'no-debugger': 'warn',
      eqeqeq: ['error', 'always'],
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
