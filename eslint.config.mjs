// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Ignore patterns
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'logs/**',
      '.env*',
      'src/**/*.js',
      'src/**/*.js.map',
      'src/**/*.d.ts',
      'src/**/*.d.ts.map',
      '!src/types/**/*.d.ts',
      'prisma/migrations/**',
      'tests/**/*.js',
      'tests/**/*.js.map',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.*', '*.config.js', '*.config.mjs', 'prisma/seed.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Disable rules that conflict with TypeScript's strict mode
      '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error for any types
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Allow console.log for debugging (you can change this to 'warn' or 'error' in production)
      'no-console': 'off',
      // Allow unused expressions in certain contexts (e.g., chai assertions)
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
        },
      ],
    },
  },
  {
    // Configuration for test files
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.test.ts', '*.spec.ts'],
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    // Configuration for config files
    files: ['*.config.*', '*.config.ts', '*.config.js', '*.config.mjs', 'prisma/seed.ts'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.*', '*.config.js', '*.config.mjs', 'prisma/seed.ts'],
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off', // Config files may use Node globals
    },
  },
);

