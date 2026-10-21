// Shared fixture state and the on_load()/on_load_error() bodies every Le_* component
// uses. Standalone (no template): the harness inlines it before the components.
window.__le = window.__le || {
  calls: {},    // key -> on_load() runs
  fail: {},     // key -> how many of the next on_load() runs throw
  errors: {},   // key -> the last Error an on_load() threw
  hooks: []     // { cls, key, error } per on_load_error() override run
};

// Runs as on_load(): `ctx` is the restricted on_load() context (this.args, this.data).
window.le_load = async function (ctx) {
  const L = window.__le;
  const key = ctx.args.key;
  L.calls[key] = (L.calls[key] || 0) + 1;
  // Async on purpose: dedup followers must have time to join, and reload() tests
  // register ready() waiters while the load is in flight.
  await new Promise((resolve) => setTimeout(resolve, ctx.args.delay || 40));
  if (L.fail[key] > 0) {
    L.fail[key]--;
    const error = new Error('le boom ' + key);
    L.errors[key] = error;
    throw error;
  }
  ctx.data.value = 'loaded:' + key + ':' + (ctx.args.id === undefined ? '' : ctx.args.id);
};

window.le_record_hook = function (cls, ctx, error) {
  window.__le.hooks.push({ cls, key: ctx.args.key, error });
};

// A plain class to register; the harness requires `class X extends` in standalone JS.
class Le_Shared_Fixture extends Jqhtml_Component {}
