class Simple_Slot_Test extends Jqhtml_Component {
  on_ready() {
    console.log('\n=== SIMPLE SLOT PASSING TEST ===\n');
    console.log('Testing: Parent_Component → Child_Component with named slots');
    console.log('');
    console.log('Parent defines:');
    console.log('  <#header>Header Content</#header>');
    console.log('  <#body>Body Content</#body>');
    console.log('');
    console.log('Child renders:');
    console.log('  <%= content("header") %>');
    console.log('  <%= content("body") %>');
    console.log('');
    console.log('Expected: Both slots render with correct content');
    console.log('\n================================\n');
  }
}
