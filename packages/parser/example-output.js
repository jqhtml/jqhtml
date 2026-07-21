// Example of generated instruction arrays from JQHTML v2 templates
// This shows what the code generator produces

// Simple component with expression
const HelloWorld = {
  name: 'HelloWorld',
  render: function render(Component, data, args, content) {
    const _output = [];
    
    _output.push("\n");
    _output.push({tag: ["h1", {}, false]});
    _output.push("Hello");
    _output.push(html(this.data.name));
    _output.push("!");
    _output.push("</h1>");
    _output.push("\n  ");
    _output.push({tag: ["p", {}, false]});
    _output.push("Welcome to JQHTML v2");
    _output.push("</p>");
    
    return [_output, this];
  }
};

// Component with control flow
const TodoList = {
  name: 'TodoList',
  render: function render(Component, data, args, content) {
    const _output = [];
    
    _output.push("\n");
    _output.push({tag: ["div", {"class": "todo-list"}, false]});
    _output.push("\n    ");
    _output.push({tag: ["h2", {}, false]});
    _output.push(html(this.data.title));
    _output.push("</h2>");
    if ((this.data.items && this.data.items.length > 0)) {
      _output.push("\n");
      _output.push({tag: ["ul", {}, false]});
      for (const item of this.data.items) {
        _output.push("\n");
        _output.push({tag: ["li", {}, false]});
        _output.push(html(item));
        _output.push("</li>");
      }
      _output.push("\n");
      _output.push("</ul>");
    } else {
      _output.push("\n");
      _output.push({tag: ["p", {}, false]});
      _output.push("No items yet");
      _output.push("</p>");
    }
    _output.push("\n");
    _output.push("</div>");
    
    return [_output, this];
  }
};

// Component with slots
const Card = {
  name: 'Card',
  render: function render(Component, data, args, content) {
    const _output = [];
    
    _output.push("\n");
    _output.push({tag: ["div", {"class": "card"}, false]});
    _output.push("\n    ");
    _output.push({tag: ["div", {"class": "card-header"}, false]});
    _output.push({slot: ["header", {}, (header) => {
      const _output = [];
      _output.push("\n");
      _output.push({tag: ["span", {}, false]});
      _output.push("Default Header");
      _output.push("</span>");
      return [_output, this];
    }]});
    _output.push("\n");
    _output.push("</div>");
    _output.push("\n    ");
    _output.push({tag: ["div", {"class": "card-body"}, false]});
    _output.push({slot: ["body", {}, null]});
    _output.push("\n");
    _output.push("</div>");
    _output.push("\n  ");
    _output.push("</div>");
    
    return [_output, this];
  }
};

/* 
Instruction types:
1. Plain strings: "Hello" 
2. Expressions: html(this.data.name)
3. Tags: {tag: ["tagname", {attributes}, selfClosing]}
4. Components: {comp: ["ComponentName", {props}]}
5. Slots: {slot: ["slotname", {props}, renderFunction]}

The runtime processes these instructions to build DOM:
- Strings become text nodes
- {tag:...} creates elements with attributes
- {comp:...} instantiates child components
- {slot:...} provides content injection points
*/