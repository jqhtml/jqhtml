class Outer_Component extends Jqhtml_Component {
  async on_ready() {
    console.log('[Outer] on_ready - creating Inner_Component');
    let $content = this.$sid('content');
    $content.component("Inner_Component", {});
    console.log('[Outer] Inner_Component created');
  }
}
