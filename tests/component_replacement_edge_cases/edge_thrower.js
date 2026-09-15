// on_stop() throws: replacing this component must fail loudly rather than overwrite a
// component whose cleanup did not run.
class Edge_Thrower extends Jqhtml_Component {
  on_stop() {
    window.__edge_stop_attempts = (window.__edge_stop_attempts || 0) + 1;
    throw new Error('edge_thrower on_stop() failed');
  }
}
