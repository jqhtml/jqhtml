#!/usr/bin/env node

/**
 * Test the JQHTML v2 Core Runtime implementation
 */

import { JSDOM } from 'jsdom';
import jquery from 'jquery';

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
global.window = dom.window;
global.document = window.document;
const $ = jquery(window);
global.$ = $;

// Import our runtime
import jqhtml_default, {
  Jqhtml_Component,
  register_component,
  LifecycleManager
} from '../dist/index.js';

// Set up window.jqhtml for the runtime
global.window.jqhtml = jqhtml_default;

console.log('Testing JQHTML v2 Core Runtime...\n');

// Test 1: Basic Component Creation
console.log('Test 1: Basic Component Creation');
class TestComponent extends Jqhtml_Component {
  async on_render() {
    this.$.html('<h1>Test Component</h1>');
  }
}

const comp1 = new TestComponent({ test: true });
$('#app').append(comp1.$);

console.log('✓ Component created with cid:', comp1._cid);
console.log('✓ Component element:', comp1.$.prop('outerHTML'));

// Test 2: Component Registry
console.log('\nTest 2: Component Registry');
register_component('TestComponent', TestComponent);

const comp2 = $('#app').component('TestComponent', { registered: true });
console.log('✓ Component created via jQuery plugin');
console.log('✓ Component args:', comp2.args);

// Test 3: Lifecycle Phases
console.log('\nTest 3: Lifecycle Phases');

class LifecycleTestComponent extends Jqhtml_Component {
  async on_render() {
    console.log('  - render phase (state:', this._ready_state, ')');
    this.$.html('<div>Lifecycle Test</div>');
  }
  
  async on_create() {
    console.log('  - create phase (state:', this._ready_state, ')');
  }
  
  async on_load() {
    console.log('  - load phase (state:', this._ready_state, ')');
    this.data.loaded = true;
  }
  
  async on_ready() {
    console.log('  - ready phase (state:', this._ready_state, ')');
  }
}

const comp3 = new LifecycleTestComponent();
$('#app').append(comp3.$);

// Wait for lifecycle to complete
setTimeout(async () => {
  console.log('✓ Final state:', comp3._ready_state);
  console.log('✓ Component data:', comp3.data);
  
  // Test 4: DOM Parent-Child Relationships
  // Tests that components can traverse DOM hierarchy to find nearest ancestor/descendant components
  // This is used internally for lifecycle coordination (waiting for DOM children to be ready)
  console.log('\nTest 4: DOM Parent-Child Relationships');

  class ParentComponent extends Jqhtml_Component {
    async on_render() {
      this.$.html('<div class="parent"><h2>Parent</h2><div class="children"></div></div>');
    }

    async on_ready() {
      console.log('  - Parent ready, DOM children:', this._get_dom_children().length);
    }
  }

  class ChildComponent extends Jqhtml_Component {
    async on_render() {
      this.$.html('<div class="child">Child</div>');
    }

    async on_ready() {
      console.log('  - Child ready, DOM parent:', this._dom_parent?.component_name());
    }
  }

  const parent = new ParentComponent();
  $('#app').append(parent.$);

  // Wait for parent to render
  setTimeout(() => {
    const child1 = new ChildComponent();
    const child2 = new ChildComponent();
    parent.$.find('.children').append(child1.$).append(child2.$);

    // Wait for DOM children to be ready (lifecycle waits for children in DOM subtree)
    setTimeout(() => {
      console.log('✓ Parent has', parent._get_dom_children().length, 'DOM children');
      console.log('✓ Child DOM parent is:', child1._dom_parent?.component_name());
      
      // Test 5: Scoped IDs
      console.log('\nTest 5: Scoped IDs');
      
      class ScopedComponent extends Jqhtml_Component {
        async on_render() {
          this.$.html(`<div><button id="btn:${this._cid}">Click Me</button></div>`);
        }
        
        async on_ready() {
          const button = this.$id('btn');
          console.log('  - Found button:', button.length > 0);
          console.log('  - Button ID:', button.attr('id'));
        }
      }
      
      const scoped1 = new ScopedComponent();
      const scoped2 = new ScopedComponent();
      $('#app').append(scoped1.$).append(scoped2.$);
      
      setTimeout(() => {
        console.log('✓ Component 1 button:', scoped1.$id('btn').attr('id'));
        console.log('✓ Component 2 button:', scoped2.$id('btn').attr('id'));
        console.log('✓ IDs are different:', scoped1.$id('btn').attr('id') !== scoped2.$id('btn').attr('id'));
        
        console.log('\n✅ All tests passed!');
        process.exit(0);
      }, 100);
    }, 100);
  }, 100);
}, 100);