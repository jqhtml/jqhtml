/**
 * @jqhtml/webpack-loader - compiles a .jqhtml file into an ES module whose default
 * export is the template object, ready for jqhtml.register_template().
 *
 * Uses only the standard loader API (this.callback, this.cacheable, this.sourceMap,
 * this.resourcePath), so the same loader runs under webpack 5 and Rspack.
 */

import { compileTemplate } from '@jqhtml/parser';

export default function jqhtml_loader(source) {
  this.cacheable(true);

  // The map comes back as an object rather than inline, so devtool decides where it goes
  let compiled;
  try {
    compiled = compileTemplate(source, this.resourcePath, { format: 'esm', sourcemap: this.sourceMap ? 'external' : false });
  } catch (error) {
    // Parse errors already end their first line with "at <file>:<line>:<column>";
    // anything else gets the file prepended so the bundler output says where it came from.
    if (!(error.line > 0)) error.message = `${this.resourcePath}: ${error.message}`;
    this.callback(error);
    return;
  }

  this.callback(null, compiled.code, compiled.map);
}
