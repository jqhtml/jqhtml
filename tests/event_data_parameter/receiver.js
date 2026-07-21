class Event_Receiver extends Jqhtml_Component {
  async on_ready() {
    console.log('[Receiver] on_ready');
    // Receiver doesn't do anything special - parent will wire up events
  }
}
