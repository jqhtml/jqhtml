import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';
import path from 'path';
import { compile as compile_scss } from 'sass';
import { audit_debug_css } from './src/debug-overlay/audit.js';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// `import css from './x.scss'` -> the compiled stylesheet as a string, after
// the debug-overlay convention audit. A violation fails the build. The only
// consumer is src/debug-overlay/, which injects the strings at runtime; see
// src/debug-overlay/CLAUDE.md.
function debug_scss() {
  return {
    name: 'jqhtml-debug-scss',
    transform(_code, id) {
      if (!id.endsWith('.scss')) return null;
      const css = compile_scss(id, { style: 'expanded' }).css;
      const violations = audit_debug_css(path.basename(id, '.scss'), css);
      if (violations.length) {
        this.error(`debug overlay stylesheet convention violated in ${path.relative(process.cwd(), id)}:\n  - ${violations.join('\n  - ')}`);
      }
      return { code: `export default ${JSON.stringify(css)};`, map: { mappings: '' } };
    }
  };
}

export default [
  // Standard CommonJS/ES module output for npm packages
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'es',
        sourcemap: true
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true
      }
    ],
    external: ['jquery'],
    plugins: [
      debug_scss(),
      replace({
        preventAssignment: true,
        values: {
          '__VERSION__': pkg.version
        }
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationMap: true,
        outDir: 'dist'
      }),
      resolve()
    ]
  },
  // Main ESM bundle for browser
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/jqhtml-core.esm.js',
      format: 'es',
      sourcemap: true,
      banner: `/**
 * JQHTML Core v${pkg.version}
 * (c) 2025 JQHTML Team
 * Released under the MIT License
 */`
    },
    external: ['jquery'],
    plugins: [
      debug_scss(),
      replace({
        preventAssignment: true,
        values: {
          '__VERSION__': pkg.version
        }
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      resolve()
    ]
  },
  // Debug bundle
  {
    input: 'src/debug-entry.ts',
    output: {
      file: 'dist/jqhtml-debug.esm.js',
      format: 'es',
      sourcemap: true
    },
    external: ['jquery'],
    plugins: [
      debug_scss(),
      replace({
        preventAssignment: true,
        values: {
          '__VERSION__': pkg.version
        }
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      resolve()
    ]
  }
];