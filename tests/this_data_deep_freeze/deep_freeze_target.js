class Deep_Freeze_Target extends Jqhtml_Component {
  on_create() {
    this.data = { items: [1, 2], user: { name: 'a', x: 1 }, nested: { list: [{ id: 1 }] } };
    // this.state, not this.data: bookkeeping for the assertions is not loaded data.
    this.state.snapshot = JSON.stringify(this.data);
  }

  on_ready() {
    console.log('');
    console.log('A. NESTED MUTATION THROWS IN on_ready():');

    const push_msg = window.deep_freeze_throws(() => this.data.items.push(3));
    window.deep_freeze_assert('this.data.items.push(3) throws -> ' + push_msg, !!push_msg);
    window.deep_freeze_assert('the push error names this.data.items',
                       !!push_msg && push_msg.includes('this.data.items'));

    const name_msg = window.deep_freeze_throws(() => { this.data.user.name = 'b'; });
    window.deep_freeze_assert('this.data.user.name = "b" throws -> ' + name_msg, !!name_msg);
    window.deep_freeze_assert('the error names this.data.user.name',
                       !!name_msg && name_msg.includes('this.data.user.name'));

    const delete_msg = window.deep_freeze_throws(() => { delete this.data.user.x; });
    window.deep_freeze_assert('delete this.data.user.x throws -> ' + delete_msg, !!delete_msg);

    const index_msg = window.deep_freeze_throws(() => { this.data.items[0] = 9; });
    window.deep_freeze_assert('this.data.items[0] = 9 throws', !!index_msg);
    window.deep_freeze_assert('the error names this.data.items[0] -> ' + index_msg,
                       !!index_msg && index_msg.includes('this.data.items[0]'));

    const deep_msg = window.deep_freeze_throws(() => { this.data.nested.list[0].id = 2; });
    window.deep_freeze_assert('this.data.nested.list[0].id = 2 throws', !!deep_msg);
    window.deep_freeze_assert('the error names this.data.nested.list[0].id -> ' + deep_msg,
                       !!deep_msg && deep_msg.includes('this.data.nested.list[0].id'));

    window.deep_freeze_assert('after every rejected mutation this.data is unchanged -> ' + JSON.stringify(this.data),
                       JSON.stringify(this.data) === this.state.snapshot);

    console.log('');
    console.log('B. READS BEHAVE EXACTLY AS BEFORE:');

    window.deep_freeze_assert('this.data.items === this.data.items',
                       this.data.items === this.data.items);
    window.deep_freeze_assert('Array.isArray(this.data.items)', Array.isArray(this.data.items));
    window.deep_freeze_assert('[...this.data.items].length === 2', [...this.data.items].length === 2);
    window.deep_freeze_assert('this.data.items.length === 2', this.data.items.length === 2);

    let sum = 0;
    for (const n of this.data.items) sum += n;
    window.deep_freeze_assert('for..of sums to 3 -> ' + sum, sum === 3);

    window.deep_freeze_assert('this.data.items.map(x => x * 2) -> ' + JSON.stringify(this.data.items.map(x => x * 2)),
                       JSON.stringify(this.data.items.map(x => x * 2)) === '[2,4]');
    window.deep_freeze_assert('this.data.items.filter(x => x > 1) -> ' + JSON.stringify(this.data.items.filter(x => x > 1)),
                       JSON.stringify(this.data.items.filter(x => x > 1)) === '[2]');
    window.deep_freeze_assert('Object.keys(this.data.user) -> ' + JSON.stringify(Object.keys(this.data.user)),
                       JSON.stringify(Object.keys(this.data.user)) === '["name","x"]');
    window.deep_freeze_assert('JSON.stringify(this.data) round-trips the whole graph',
                       JSON.stringify(this.data) === this.state.snapshot);
    window.deep_freeze_assert('the template rendered the nested values -> ' + this.$.text().trim(),
                       this.$.text().trim() === 'frozen: a / 2 items');
  }
}
