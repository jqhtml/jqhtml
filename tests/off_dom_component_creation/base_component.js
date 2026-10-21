class Base_Component extends Jqhtml_Component {
  async on_ready() {
    console.log('[Base_Component] on_ready: Creating off-DOM component...');

    // Create component completely off-DOM
    const $offDomElement = $('<div>').component('Second_Component');

    console.log('[Base_Component] Waiting for the off-DOM boot before attaching to DOM...');

    // Wait until the whole off-DOM subtree is ready. Awaited, not a fixed delay, so
    // the order holds however loaded the machine is.
    await $offDomElement.component().ready();

    console.log('[Base_Component] Attaching Second_Component to DOM...');
    window.__off_dom_log.push('attach');
    window.__off_dom_before_attach = {
      connected: $offDomElement[0].isConnected,
      ready: $offDomElement.component()._ready_state === 4,
      text: $offDomElement.find('.Fourth_Level_Child').text().trim()
    };

    // Attach to DOM after component has fully initialized off-DOM
    this.$sid('off_dom_target').append($offDomElement);

    console.log('[Base_Component] Second_Component attached to DOM');
  }
}
