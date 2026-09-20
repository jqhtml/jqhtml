/**
 * Model classes for the coordinator_follower_class_instances test.
 *
 * Every one of these has a wire form that a plain JSON round trip cannot undo,
 * which is exactly what the old follower copy (JSON.stringify/JSON.parse) did.
 */

// Wire form renames the field and adds a derived flag - toJSON() output is not
// the instance's own properties.
class Cfc_Rich_Text {
  constructor(raw) { this._raw = raw; }
  toJSON() { return { __TEXT: 'Cfc_Rich_Text', raw: this._raw, empty: this._raw.length === 0 }; }
  static from_plain(plain) { return new Cfc_Rich_Text(plain.raw); }
  is_empty() { return this._raw.length === 0; }
  get raw() { return this._raw; }
}

// State in a private field: own properties are empty, so an explicit to_plain is required.
class Cfc_Money {
  #cents;
  constructor(cents) { this.#cents = cents; }
  get cents() { return this.#cents; }
  is_zero() { return this.#cents === 0; }
  format() { return '$' + (this.#cents / 100).toFixed(2); }
}

// Registered with NO options but defining toJSON(): the own-props path must
// bypass toJSON() on both copy paths.
class Cfc_Plain_Model {
  constructor(id) { this.id = id; }
  toJSON() { return { wire_id: this.id }; }
  label() { return 'model#' + this.id; }
}

window.Cfc_Rich_Text = Cfc_Rich_Text;
window.Cfc_Money = Cfc_Money;
window.Cfc_Plain_Model = Cfc_Plain_Model;

window.jqhtml.register_cache_class(Cfc_Rich_Text, { from_plain: Cfc_Rich_Text.from_plain });
window.jqhtml.register_cache_class(Cfc_Money, {
  to_plain: (money) => money.cents,
  from_plain: (cents) => new Cfc_Money(cents)
});
window.jqhtml.register_cache_class(Cfc_Plain_Model);
