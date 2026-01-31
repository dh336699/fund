import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores } from 'eslint/config';
import { FlatCompat } from '@eslint/eslintrc';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier/flat';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default defineConfig([
  // 基础忽略（Next 默认也会忽略，但这里显式写清楚）
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),

  // Airbnb（含 TS）——通过 FlatCompat 兼容进 flat config
  ...compat.extends(
    'airbnb',
    'airbnb/hooks',
    'airbnb-typescript'
  ),

  // Next.js 规则（用 plugin 方式，避免和 airbnb 的 react/import/jsx-a11y 等重复配置打架）
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      // 如果你想更严格（Core Web Vitals），可改成：
      // ...nextPlugin.configs['core-web-vitals']?.rules,
    },
  },

  // TypeScript 项目类型信息（给部分 TS 规则用）
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      // 解决 import/no-unresolved + TS path alias
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json'],
        },
      },
    },
    rules: {
      // Next/React 17+ 不需要显式 import React
      'react/react-in-jsx-scope': 'off',
    },
  },

  // 关闭所有和 Prettier 冲突的格式类 ESLint 规则（放最后覆盖）
  prettier,
]);
