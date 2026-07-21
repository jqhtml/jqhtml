#!/usr/bin/env node

import { Lexer, Parser, CodeGenerator } from './dist/index.js';

console.log('JQHTML Binding Syntax Detailed Test');
console.log('===================================\n');

const template = `<Define:TestBindings>
  <!-- Test different binding value formats -->
  
  <!-- Simple identifiers -->
  <div :prop1=value1 @event1=handler1></div>
  
  <!-- Quoted values (should still be expressions) -->
  <div :prop2="value2" @event2="handler2"></div>
  
  <!-- Complex expressions -->
  <div 
    :prop3="obj.nested.value"
    :prop4="method(arg1, arg2)"
    :prop5="condition ? yes : no"
    :prop6="{ key: 'value' }"
    @event3="obj.method()"
    @event4="(e) => handleEvent(e)"
  ></div>
  
  <!-- Mixed with other attributes -->
  <button
    class="btn"
    :class="btnClass"
    $theme="dark"
    $active=isActive
    :disabled="!canSubmit"
    @click="submit"
  >
    Submit
  </button>
</Define:TestBindings>`;

console.log('Parsing template...\n');

// Parse
const lexer = new Lexer(template);
const tokens = lexer.tokenize();
const parser = new Parser(tokens, template);
const ast = parser.parse();

// Generate
const generator = new CodeGenerator();
const result = generator.generate(ast);

// Get render function
const component = result.components.get('TestBindings');
const renderFn = component.render_function;

// Extract the attributes from each tag by parsing the render function
console.log('Analyzing generated attributes:\n');

// Simple regex to find tag instructions
const tagPattern = /_output\.push\(\{tag: \["(\w+)", (\{[^}]+\}), (true|false)\]\}\);/g;
let match;
let tagIndex = 1;

while ((match = tagPattern.exec(renderFn)) !== null) {
  const [, tagName, attrsStr, selfClosing] = match;
  console.log(`Tag ${tagIndex}: <${tagName}>`);
  console.log('Attributes:', attrsStr);
  
  // Try to evaluate the attributes object
  try {
    // Create a safe context for evaluation
    const evalContext = {
      value1: 'value1',
      value2: 'value2', 
      handler1: 'handler1',
      handler2: 'handler2',
      obj: 'obj',
      method: 'method',
      arg1: 'arg1',
      arg2: 'arg2',
      condition: 'condition',
      yes: 'yes',
      no: 'no',
      e: 'e',
      handleEvent: 'handleEvent',
      btnClass: 'btnClass',
      isActive: 'isActive',
      canSubmit: 'canSubmit',
      submit: 'submit'
    };
    
    // Create function to safely evaluate
    const evalFn = new Function(...Object.keys(evalContext), `return ${attrsStr}`);
    const attrs = evalFn(...Object.values(evalContext));
    
    console.log('Parsed attributes:');
    for (const [key, value] of Object.entries(attrs)) {
      console.log(`  ${key}: ${typeof value === 'string' ? `"${value}"` : value} (${typeof value})`);
    }
  } catch (e) {
    console.log('Could not evaluate attributes:', e.message);
  }
  
  console.log('---');
  tagIndex++;
}

console.log('\n\nFull Render Function:');
console.log('--------------------');
console.log(renderFn);

console.log('\n✅ Test complete!');