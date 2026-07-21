import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

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