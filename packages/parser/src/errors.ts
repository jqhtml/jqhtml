// JQHTML Parser Error Classes
// Provides helpful error messages with code context

export class JQHTMLParseError extends Error {
  public line: number;
  public column: number;
  public endLine?: number;
  public endColumn?: number;
  public source?: string;
  public filename?: string;
  public severity: 'error' | 'warning' = 'error';
  public suggestion?: string;

  constructor(
    message: string,
    line: number,
    column: number,
    source?: string,
    filename?: string
  ) {
    super(message);
    this.name = 'JQHTMLParseError';
    this.line = line;
    this.column = column;
    this.source = source;
    this.filename = filename;

    // Auto-add suggestions
    this.suggestion = getSuggestion(message);

    // Build the full error message with context
    this.message = this.buildErrorMessage(message);
  }
  
  private buildErrorMessage(message: string): string {
    let result = message;

    // Add location info IMMEDIATELY after message (required for RSpade parsing)
    // Format: "at filename:line:column" (RSpade regex: /at [^:]+:(\d+):(\d+)/i)
    if (this.filename) {
      result += `\nat ${this.filename}:${this.line}:${this.column}`;
    } else {
      // Fallback to generic format if no filename
      result += `\nat <unknown>:${this.line}:${this.column}`;
    }

    // Add code snippet if source is available
    if (this.source) {
      const snippet = this.getCodeSnippet();
      if (snippet) {
        result += '\n\n' + snippet;
      }
    }

    // Add suggestion AFTER code snippet (don't interfere with parsing)
    if (this.suggestion) {
      result += this.suggestion;
    }

    return result;
  }
  
  private getCodeSnippet(): string {
    if (!this.source) return '';

    const lines = this.source.split('\n');
    const lineIndex = this.line - 1;

    // Show 3 lines before and after for better context
    const contextLines = 3;
    const startLine = Math.max(0, lineIndex - contextLines);
    const endLine = Math.min(lines.length - 1, lineIndex + contextLines);

    let snippet = '';

    for (let i = startLine; i <= endLine; i++) {
      const lineNum = i + 1;
      const isErrorLine = i === lineIndex;
      const prefix = isErrorLine ? '>' : ' ';

      // Line number with padding
      const lineNumStr = String(lineNum).padStart(5, ' ');

      snippet += `${prefix} ${lineNumStr} | ${lines[i]}\n`;

      // Add pointer to error column with better highlighting
      if (isErrorLine) {
        const spaces = ' '.repeat(this.column + 8);
        const carets = '^'.repeat(Math.min(lines[i].length - this.column + 1, 20));
        snippet += `${spaces}${carets}\n`;
      }
    }

    return snippet;
  }
}

// Common error factories
export function unclosedError(
  type: string,
  name: string,
  line: number,
  column: number,
  source?: string,
  filename?: string
): JQHTMLParseError {
  return new JQHTMLParseError(
    `Unclosed ${type}: ${name}`,
    line,
    column,
    source,
    filename
  );
}

export function mismatchedTagError(
  opening: string,
  closing: string,
  line: number,
  column: number,
  source?: string,
  filename?: string
): JQHTMLParseError {
  return new JQHTMLParseError(
    `Mismatched tags: expected </${opening}>, found </${closing}>`,
    line,
    column,
    source,
    filename
  );
}

export function syntaxError(
  message: string,
  line: number,
  column: number,
  source?: string,
  filename?: string
): JQHTMLParseError {
  return new JQHTMLParseError(
    `Syntax error: ${message}`,
    line,
    column,
    source,
    filename
  );
}

// Helpful suggestions for common mistakes
export function getSuggestion(error: string): string {
  if (error.includes('Unclosed if statement')) {
    return '\nDid you forget the closing <% } %>?';
  }
  if (error.includes('Unclosed for statement')) {
    return '\nDid you forget the closing <% } %>?';
  }
  if (error.includes('Unclosed component definition')) {
    return '\nDid you forget the closing </Define:ComponentName> tag?';
  }
  if (error.includes('Unclosed slot')) {
    return '\nDid you mean to use a self-closing slot? Try <Slot:name /> instead.';
  }
  if (error.includes('Unclosed tag') || error.includes('Unclosed component')) {
    return '\n\nThis element was opened but never closed. Make sure every opening tag has a matching closing tag.\n' +
      'Common causes:\n' +
      '  • Missing closing tag (e.g., forgot </div>)\n' +
      '  • Tag opened in if/for block but closed outside (split tag conditional - not allowed)\n' +
      '  • Mismatched nesting (e.g., <div><span></div></span>)\n\n' +
      'If opened in <% if/for %>, it MUST close in the same block:\n' +
      '  ❌ <% if (x) { %> <div> <% } %> </div>\n' +
      '  ✅ <% if (x) { %> <div>...</div> <% } %>';
  }
  if (error.includes('Expected %>')) {
    return '\nCheck if you have a %> inside a string literal. Escape it or use a different approach.';
  }
  if (error.includes('Mismatched tags')) {
    return '\nCheck that your opening and closing tags match exactly (case-sensitive).';
  }
  if (error.includes('Mixed content not allowed')) {
    return '\nWhen using slots, wrap all content in <Slot:slotname> tags. Use <Slot:default> for the main content.';
  }
  return '';
}

// Error collection for batch reporting
export class ErrorCollector {
  private errors: JQHTMLParseError[] = [];
  private maxErrors: number = 10;

  constructor(maxErrors: number = 10) {
    this.maxErrors = maxErrors;
  }

  add(error: JQHTMLParseError): void {
    if (this.errors.length < this.maxErrors) {
      this.errors.push(error);
    }
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): JQHTMLParseError[] {
    return this.errors;
  }

  throwIfErrors(): void {
    if (this.errors.length === 0) return;

    if (this.errors.length === 1) {
      throw this.errors[0];
    }

    // Multiple errors - create a combined message
    let message = `Found ${this.errors.length} errors:\n\n`;

    this.errors.forEach((error, index) => {
      message += `Error ${index + 1}: ${error.message}\n`;
      if (index < this.errors.length - 1) {
        message += '\n';
      }
    });

    throw new Error(message);
  }
}