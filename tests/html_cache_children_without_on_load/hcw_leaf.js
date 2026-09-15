// A template-only child: NO on_load(), so it never reaches _ready_state 2. An html-mode
// parent waits for every child's post-load render before snapshotting; a child like this
// one has no post-load render, and the wait used to hang on it forever.
class Hcw_Leaf extends Jqhtml_Component {
  on_ready() {
    window.__hcw_leaf_readies = (window.__hcw_leaf_readies || 0) + 1;
  }
}
