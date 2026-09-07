// A .scss import is the compiled stylesheet as a string - see rollup.config.js
// (debug_scss plugin) and src/debug-overlay/CLAUDE.md.
declare module '*.scss' {
  const css: string;
  export default css;
}
