class Lq_Fetch extends Jqhtml_Component {
  on_create() {
    this.data.value = '';
  }

  // A readable cache key, so the test can find the entry for each args value.
  cache_id() {
    return 'lq_' + this.args.key;
  }

  async on_load() {
    const key = this.args.key;
    window.__lq_fetch.log.push('start:' + key);
    await new Promise(resolve => setTimeout(resolve, key === 'old' ? 200 : 20));
    window.__lq_fetch.log.push('end:' + key);
    this.data.value = 'value-' + key;
  }
}
