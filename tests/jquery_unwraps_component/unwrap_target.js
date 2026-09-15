// A plain child component: the thing that gets passed to $().
class Unwrap_Target extends Jqhtml_Component {
  on_create() {
    this.data.label = 'target';
  }
}
