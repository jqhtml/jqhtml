// Example output showing component invocation with slots
// This is what gets generated from a template that uses a component

// Input template:
/*
<Define:DashboardPage>
  <div class="dashboard">
    <h1>Dashboard</h1>
    
    <Card>
      <#header>
        <h3>User Stats</h3>
      </#header>
      <#body>
        <p>Total users: <%= this.data.userCount %></p>
        <p>Active today: <%= this.data.activeToday %></p>
      </#body>
    </Card>
    
    <Card>
      <#header>
        <h3>Recent Activity</h3>
      </#header>
      <#body>
        <ul>
          <% for (const activity of this.data.recentActivities): %>
            <li><%= activity %></li>
          <% endfor; %>
        </ul>
      </#body>
    </Card>
  </div>
</Define:DashboardPage>
*/

// Generated output:
const DashboardPage = {
  name: 'DashboardPage',
  render: function render(Component, data, args, content) {
    const _output = [];
    
    _output.push("\n");
    _output.push({tag: ["div", {"class": "dashboard"}, false]});
    _output.push("\n    ");
    _output.push({tag: ["h1", {}, false]});
    _output.push("Dashboard");
    _output.push("</h1>");
    _output.push("\n    \n    ");
    
    // NOTE: Currently generating as tag, should be {comp: ["Card", {}]}
    _output.push({tag: ["Card", {}, false]});
    
    // These slots are the content to pass TO the Card component
    _output.push({slot: ["header", {}, (header) => {
      const _output = [];
      _output.push("\n");
      _output.push({tag: ["h3", {}, false]});
      _output.push("User Stats");
      _output.push("</h3>");
      return [_output, this];
    }]});
    _output.push("\n");
    _output.push("      ");
    _output.push({slot: ["body", {}, (body) => {
      const _output = [];
      _output.push("\n");
      _output.push({tag: ["p", {}, false]});
      _output.push("Total users:");
      _output.push(html(this.data.userCount));
      _output.push("</p>");
      _output.push("\n        ");
      _output.push({tag: ["p", {}, false]});
      _output.push("Active today:");
      _output.push(html(this.data.activeToday));
      _output.push("</p>");
      return [_output, this];
    }]});
    _output.push("\n");
    _output.push("</Card>");
    
    // Second Card invocation
    _output.push("\n    \n    ");
    _output.push({tag: ["Card", {}, false]});
    _output.push({slot: ["header", {}, (header) => {
      const _output = [];
      _output.push("\n");
      _output.push({tag: ["h3", {}, false]});
      _output.push("Recent Activity");
      _output.push("</h3>");
      return [_output, this];
    }]});
    _output.push("\n");
    _output.push("      ");
    _output.push({slot: ["body", {}, (body) => {
      const _output = [];
      _output.push("\n");
      _output.push({tag: ["ul", {}, false]});
      for (const activity of this.data.recentActivities) {
        _output.push("\n");
        _output.push({tag: ["li", {}, false]});
        _output.push(html(activity));
        _output.push("</li>");
      }
      _output.push("\n");
      _output.push("</ul>");
      return [_output, this];
    }]});
    _output.push("\n");
    _output.push("</Card>");
    _output.push("\n  ");
    _output.push("</div>");
    
    return [_output, this];
  }
};

/*
Current behavior:
- <Card> is treated as an HTML tag: {tag: ["Card", {}, false]}
- Slots within <Card>...</Card> are the content to pass to Card's slots

What should happen (future enhancement):
- <Card> should generate: {comp: ["Card", {}, slots]}
- Where slots contains the slot content functions
- This is the "Parser Enhancement: Nested Components" task
*/