// Gated_Component
//
// Registers one or more "load gates" during on_create() via this.gate_load().
// The framework awaits those gates before the FIRST on_load() runs.
//
// Gate promises are looked up from a global registry keyed by args.gate_key so
// the test harness controls exactly when each gate settles. gate_key is a plain
// string, keeping args serializable (cache-compatible).
//
// Per-key counters in window.__gate_counts track create/load/ready invocations
// so the test can assert precise lifecycle ordering.

function __gc_bump(key, phase) {
  window.__gate_counts = window.__gate_counts || {};
  const entry = window.__gate_counts[key] || (window.__gate_counts[key] = { create: 0, load: 0, ready: 0 });
  entry[phase]++;
}

class Gated_Component extends Jqhtml_Component {
  on_create() {
    this.data.message = 'initial';
    __gc_bump(this.args.gate_key, 'create');

    const gates = (window.__gate_registry || {})[this.args.gate_key];
    if (gates) {
      for (const promise of gates) {
        this.gate_load(promise);
      }
    }
  }

  async on_load() {
    __gc_bump(this.args.gate_key, 'load');
    this.data.message = 'loaded';
  }

  async on_ready() {
    __gc_bump(this.args.gate_key, 'ready');
  }
}
