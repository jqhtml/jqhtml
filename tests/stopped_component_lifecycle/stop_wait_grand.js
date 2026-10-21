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

class Stop_Wait_Grand extends Jqhtml_Component {
  async on_load() {
    const hold = await window.__hold_or_delay('grand', 150);
    this.data.label = 'grand';
    if (hold) hold.finished();
  }
}
