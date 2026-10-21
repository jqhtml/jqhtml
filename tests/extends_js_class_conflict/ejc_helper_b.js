// Ejc_Helper_B - a plain helper class with NO template, sitting between a child and the
// templated Ejc_Grid_B.
class Ejc_Helper_B extends Ejc_Grid_B {
  helper_method() { return 'helper_b'; }
}

window.Ejc_Helper_B = Ejc_Helper_B;
