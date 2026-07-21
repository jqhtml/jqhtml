#!/usr/bin/env node

import { Lexer, Parser, CodeGenerator } from './dist/index.js';

console.log('JQHTML Binding Syntax Test');
console.log('==========================\n');

const template = `<Define:InteractiveCard>
  <div class="card" :class="dynamicClasses" :style="{ backgroundColor: bgColor }">
    <!-- Property bindings -->
    <input :value="formData.name" :disabled="isLoading" />
    <textarea :rows="lineCount" :placeholder="getPlaceholder()"></textarea>
    
    <!-- Event bindings -->
    <button @click="handleClick" @mouseover="showTooltip">
      Click Me
    </button>
    
    <!-- Multiple bindings -->
    <form @submit="handleSubmit" :action="formAction">
      <input 
        :type="inputType"
        :value="inputValue"
        @input="updateValue"
        @blur="validateField"
        @focus="clearError"
      />
    </form>
    
    <!-- Mixed with regular attributes -->
    <div 
      class="static-class"
      :class="dynamicClass"
      data-static="value"
      :data-dynamic="computedValue"
      @click="handleDivClick"
    >
      Mixed attributes
    </div>
    
    <!-- Component with bindings -->
    <ChildComponent
      :user="currentUser"
      :settings="userSettings"
      @save="handleSave"
      @cancel="handleCancel"
    />
  </div>
</Define:InteractiveCard>`;

console.log('Template:');
console.log('---------');
console.log(template);
console.log('\n');

// Parse the template
const lexer = new Lexer(template);
const tokens = lexer.tokenize();
const parser = new Parser(tokens, template);
const ast = parser.parse();

// Generate code
const generator = new CodeGenerator();
const result = generator.generate(ast);

console.log('Generated Code:');
console.log('---------------');
console.log(result.code);

// Extract just the render function for detailed inspection
const component = result.components.get('InteractiveCard');
if (component) {
  console.log('\n\nRender Function Detail:');
  console.log('-----------------------');
  console.log(component.render_function);
  
  console.log('\n\nKey Observations:');
  console.log('-----------------');
  console.log('1. Property bindings (should be data-bind-*):');
  console.log('   - :class → data-bind-class');
  console.log('   - :value → data-bind-value');
  console.log('   - :disabled → data-bind-disabled');
  console.log('   - :type → data-bind-type');
  
  console.log('\n2. Event bindings (should be data-on-*):');
  console.log('   - @click → data-on-click');
  console.log('   - @mouseover → data-on-mouseover');
  console.log('   - @submit → data-on-submit');
  console.log('   - @input → data-on-input');
  console.log('   - @blur → data-on-blur');
  
  console.log('\n3. Values should be expressions, not quoted strings');
  console.log('   - :value="formData.name" → data-bind-value: formData.name');
  console.log('   - @click="handleClick" → data-on-click: handleClick');
}

console.log('\n✅ Binding syntax test complete!');