class Event_Emitter extends Jqhtml_Component {
  async on_ready() {
    console.log('[Emitter] on_ready - triggering event with data');

    // Trigger a custom event with data
    this.trigger('my-event', { key: 'test-key', value: 42, nested: { foo: 'bar' } });

    console.log('[Emitter] Event triggered with data: { key: "test-key", value: 42, nested: { foo: "bar" } }');
  }
}
