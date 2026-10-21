/**
 * Unified JQHTML Compiler Module
 *
 * Single source of truth for compiling JQHTML templates to JavaScript
 * with proper sourcemap generation and version injection.
 */

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { SourceMapGenerator } from 'source-map';
import { CodeGenerator, ComponentCode, add_render_mappings } from './codegen.js';
import { js_string, js_string_single } from './js_literal.js';
import { add_hidden_close_note } from './errors.js';

export interface CompileOptions {
  format: 'iife' | 'esm' | 'cjs' | 'umd';
  /**
   * true: an inline sourcemap (a data: URL comment at the end of `code`) - the default
   * way to ship one. 'external': no comment; the map is returned as `map` for the
   * caller to write or hand on. false: none.
   */
  sourcemap: boolean | 'external';
  version?: string;
}

/** A version 3 source map. */
export interface SourceMapObject {
  version: number;
  file?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

export interface CompiledOutput {
  code: string;
  componentName: string;
  /** Only with `sourcemap: 'external'`. */
  map?: SourceMapObject;
}

/**
 * Compile a JQHTML template to JavaScript
 *
 * @param source - The JQHTML template source code
 * @param filename - The source filename for sourcemap generation
 * @param options - Compilation options
 * @returns The compiled JavaScript code as a string
 */
export function compileTemplate(
  source: string,
  filename: string,
  options: CompileOptions
): CompiledOutput {
  // Validate: content() must be called with <%= %> not <% %>
  if (source.includes('<% content()')) {
    throw new Error(
      `Invalid content() usage in ${filename}:\n\n` +
      `content() must be output using <%= %> tags, not <% %> tags.\n\n` +
      `Wrong:  <% content() %>\n` +
      `Right:  <%= content() %>\n\n` +
      `This ensures the content is properly rendered as output.`
    );
  }

  // 1. Parse the template, and 2. generate code WITHOUT sourcemap (we'll create it
  // after wrapping). A failure is explained by any %> a // comment hid.
  const lexer = new Lexer(source, filename);
  let result;
  try {
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, source, filename);
    const ast = parser.parse();
    const generator = new CodeGenerator();
    result = generator.generate(ast, filename, source);
  } catch (error) {
    throw add_hidden_close_note(error, lexer.hidden_closes);
  }

  // 3. Get component info
  const componentName = result.components.keys().next().value;
  if (!componentName) {
    throw new Error('No component found in template');
  }
  const component = result.components.get(componentName);
  if (!component) {
    throw new Error(`Component ${componentName} not found in results`);
  }

  // 4. Apply format wrapping and version injection
  const version = options.version || getPackageVersion();
  const formatted = formatOutput(
    component,
    componentName,
    options.format,
    version
  );
  let output = formatted.code;

  // 5. Generate sourcemap AFTER wrapping (if requested)
  if (options.sourcemap === 'external') {
    const map = generateSourcemapForWrappedCode(output, component, formatted, source, filename);
    return { code: output, componentName, map };
  }
  if (options.sourcemap) {
    const map = generateSourcemapForWrappedCode(output, component, formatted, source, filename);
    output = output + '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,' +
      Buffer.from(JSON.stringify(map)).toString('base64');
  }

  return {
    code: output,
    componentName
  };
}

/**
 * Get package version from package.json
 * We can't use dynamic import in TypeScript, so we'll inject at build time
 */
function getPackageVersion(): string {
  // This will be replaced by the build process
  // The CLI will pass the version directly
  return '__PARSER_VERSION__';
}

/**
 * Serialize defineArgs/defaultAttributes with proper handling of identifiers and expressions
 * Quoted values become strings, identifiers/expressions become raw JavaScript
 */
function serializeAttributeObject(obj: Record<string, any>): string {
  if (!obj || Object.keys(obj).length === 0) {
    return '{}';
  }

  const entries: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    // Check if value is a parsed attribute object with type info
    if (value && typeof value === 'object' && (value.identifier || value.expression)) {
      // Identifier or expression - output as raw JavaScript (no quotes)
      entries.push(`${js_string(key)}: ${value.value}`);
    } else if (value && typeof value === 'object' && value.quoted) {
      // Quoted string - output as string literal
      entries.push(`${js_string(key)}: ${js_string(value.value)}`);
    } else {
      // Simple value - output as-is via JSON.stringify
      entries.push(`${js_string(key)}: ${typeof value === 'string' ? js_string(value) : JSON.stringify(value)}`);
    }
  }

  return `{${entries.join(', ')}}`;
}

// Stands in for the render function while the wrapper is built, so where the render
// function lands is measured, not searched for. Author text in the wrapper is always a
// JSON-escaped literal, which never contains a raw NUL.
const RENDER_SLOT = '\u0000render\u0000';

/** The wrapped module, and where its render function starts (1-based line, 0-based column). */
interface FormattedOutput {
  code: string;
  render_line: number;
  render_column: number;
}

/**
 * Format the generated code according to the specified module format
 * Moved from CLI compiler's formatOutput function
 */
function formatOutput(
  componentInfo: ComponentCode,
  componentName: string,
  format: string,
  version: string
): FormattedOutput {
  const name = componentInfo.name;

  // Build the component definition
  let componentDef = `{
  __jqhtml_template: true,
  _jqhtml_version: ${js_string_single(version)},
  name: ${js_string_single(componentInfo.name)},
  tag: ${js_string_single(componentInfo.tagName)},
  defaultAttributes: ${serializeAttributeObject(componentInfo.defaultAttributes)},`;

  // Add defineArgs if present ($ attributes from Define tag)
  if (componentInfo.defineArgs) {
    componentDef += `\n  defineArgs: ${serializeAttributeObject(componentInfo.defineArgs)},`;
  }

  // Add extends if present (template inheritance)
  if (componentInfo.extends) {
    componentDef += `\n  extends: ${js_string_single(componentInfo.extends)},`;
  }

  componentDef += `\n  render: ${RENDER_SLOT},
  dependencies: ${JSON.stringify(componentInfo.dependencies)}
}`;

  let output;
  switch (format) {
    case 'iife':
      // Variable assignment - no auto-registration
      // Consumer must call jqhtml.register_template() explicitly
      output = `// Compiled from: ${componentName}.jqhtml
var template_${name} = ${componentDef};`;
      break;

    case 'esm':
      // ES Module export - no auto-registration
      // Consumer must call jqhtml.register_template() explicitly
      output = `// ES Module: ${name}
const template_${name} = ${componentDef};

export { template_${name} };
export default template_${name};`;
      break;

    case 'cjs':
      // CommonJS export - no auto-registration
      // Consumer must call jqhtml.register_template() explicitly
      output = `// CommonJS Module: ${name}
'use strict';

const template_${name} = ${componentDef};

module.exports = template_${name};
module.exports.default = template_${name};
module.exports.template_${name} = template_${name};`;
      break;

    case 'umd':
      // Universal Module Definition - no auto-registration
      // Consumer must call jqhtml.register_template() explicitly
      output = `(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.template_${name} = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return ${componentDef};
}));`;
      break;

    default:
      throw new Error(`Unknown format: ${format}`);
  }

  const at = output.indexOf(RENDER_SLOT);
  const before = output.slice(0, at);
  return {
    code: before + componentInfo.render_function.trimEnd() + output.slice(at + RENDER_SLOT.length),
    render_line: before.split('\n').length,
    render_column: before.length - before.lastIndexOf('\n') - 1
  };
}

/**
 * Generate the sourcemap for the wrapped module.
 *
 * Render line N is source line N (codegen places every node on the line it is written
 * on), so the render function's segments come from codegen as they are, shifted to
 * where the wrapper put the function. Each emitted node has its own segment, at its
 * generated column, naming its source line and column. Wrapper lines map to the
 * <Define> tag.
 */
function generateSourcemapForWrappedCode(
  wrappedCode: string,
  component: ComponentCode,
  formatted: FormattedOutput,
  sourceContent: string,
  filename: string
): SourceMapObject {
  const outputLines = wrappedCode.split('\n').length;
  const renderLines = component.render_function.trimEnd().split('\n').length;
  const map = new SourceMapGenerator();
  map.setSourceContent(filename, sourceContent);

  const wrapper_line = (line: number) => map.addMapping({
    generated: { line, column: 0 },
    source: filename,
    original: component.define_position
  });

  for (let line = 1; line < formatted.render_line; line++) {
    wrapper_line(line);
  }
  add_render_mappings(map, component, filename, formatted.render_line, formatted.render_column);
  for (let line = formatted.render_line + renderLines; line <= outputLines; line++) {
    wrapper_line(line);
  }

  const sourcemap = map.toJSON();

  // A map that disagrees with its own code is never safe to emit: a segment naming a
  // generated line that does not exist is a phantom line, and consumers that rebuild
  // output from the map (source-map's SourceNode.fromStringWithSourceMap, which most
  // bundlers use for concatenation) materialise each phantom as a bare `undefined`
  // identifier - executable JavaScript that throws at top level. Every generated line
  // has a segment, so this is an invariant; a violation is a compiler bug.
  const finalCount = sourcemap.mappings.split(';').length;
  if (finalCount !== outputLines) {
    throw new Error(
      `Sourcemap line mismatch for ${filename}: output has ${outputLines} lines, ` +
      `sourcemap has ${finalCount} mapping segments. This is a bug in the JQHTML compiler.`
    );
  }

  return sourcemap;
}
