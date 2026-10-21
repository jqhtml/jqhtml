// A registered cache class: on_load() must get an instance of it back from the
// on_create() snapshot, with its prototype (methods) intact.
class Fidelity_Model {
  constructor(n) { this.n = n; }
  doubled() { return this.n * 2; }
}
window.jqhtml.register_cache_class(Fidelity_Model);
window.Fidelity_Model = Fidelity_Model;
