// No_Load_Gated_Component
//
// Registers a gate in on_create() but defines NO custom on_load(). Because there
// is no load phase to gate, the framework must ignore the gate entirely: no
// throw, no delay. The component reaches ready even though its gate never settles.

class No_Load_Gated_Component extends Jqhtml_Component {
  on_create() {
    const gates = (window.__gate_registry || {})[this.args.gate_key];
    if (gates) {
      for (const promise of gates) {
        this.gate_load(promise);
      }
    }
  }
  // No on_load() override on purpose.
}
