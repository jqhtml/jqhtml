window.stop_log = window.stop_log || [];   // "<event>:<key>[:<cid>]" entries, in order

// Tests can hold an on_load() open: test.js hold_load(tag) registers a hold that the load
// waits on instead of its timer, so "still loading" never depends on system load. Returns
// the hold (or null) once the load may continue.
window.__hold_or_delay = window.__hold_or_delay || async function (tag, ms) {
  const holds = window.__load_holds || {};
  const hold = holds[tag];
  if (!hold) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return null;
  }
  delete holds[tag];
  hold.entered();
  await hold.released;
  return hold;
};

class Stop_Load_Card extends Jqhtml_Component {
  async on_load() {
    window.stop_log.push('card_on_load:' + this.args.key);
    const hold = await window.__hold_or_delay('card:' + this.args.key, 80);
    this.data.label = 'Key ' + this.args.key;
    if (hold) hold.finished();
  }
  on_loaded() { window.stop_log.push('card_on_loaded:' + this.args.key + ':' + this._cid); }
  on_ready() { window.stop_log.push('card_on_ready:' + this.args.key + ':' + this._cid); }
}
