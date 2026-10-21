class Ejc_Grid_A extends Jqhtml_Component {
  which_parent() { return 'A'; }
}

// Made global so the children can extend it: the harness inlines every dependency in
// its own try{} block, so a bare class declaration is not visible to the next one.
window.Ejc_Grid_A = Ejc_Grid_A;
