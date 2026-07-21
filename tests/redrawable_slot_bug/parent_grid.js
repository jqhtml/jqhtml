class Parent_Grid extends Jqhtml_Component {
  on_create() {
    this.data.rows = [
      {id: 1, name: 'John'},
      {id: 2, name: 'Jane'},
      {id: 3, name: 'Bob'}
    ];
  }
}
