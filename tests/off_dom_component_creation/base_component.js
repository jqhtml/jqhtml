class Base_Component extends Jqhtml_Component {
  async on_ready() {
    console.log('[Base_Component] on_ready: Creating off-DOM component...');

    // Create component completely off-DOM
    const $offDomElement = $('<div>').component('Second_Component');

    console.log('[Base_Component] Waiting 100ms before attaching to DOM...');

    // Wait 100ms to simulate delay before DOM attachment
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[Base_Component] Attaching Second_Component to DOM...');

    // Attach to DOM after component has fully initialized off-DOM
    this.$sid('off_dom_target').append($offDomElement);

    console.log('[Base_Component] Second_Component attached to DOM');
  }
}
