class Shared_Ref_Child extends Jqhtml_Component {
  on_create() {
    this.data.a = null;
    this.data.b = null;
  }

  async on_load() {
    // Same array reference assigned under two different keys.
    // This is a shared (DAG) reference, NOT a circular reference.
    const arr = [1, 2, 3];
    this.data.a = arr;
    this.data.b = arr;
  }
}
