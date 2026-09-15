class Load_Mutation_Target extends Jqhtml_Component {
  on_create() {
    this.data = { items: [1, 2], user: { name: 'a' } };
  }

  async on_load() {
    // Unfrozen here - nested mutation is exactly what on_load() is for.
    this.data.items.push(3);
    this.data.user.name = 'b';

    // The read-only this.args proxy must hand out the SAME wrapper for one object arg
    // (audit LOW: a fresh Proxy per read made identity comparisons fail).
    this.data.args_identity_stable = (this.args.filter === this.args.filter);
    this.data.args_nested_identity_stable = (this.args.filter.tags === this.args.filter.tags);
    this.data.args_value_readable = this.args.filter.mode;

    // The object on_load() hands back must never be aliased into the frozen this.data:
    // on_ready() keeps a reference to it through window and proves mutations cannot reach it.
    const returned = { tag: 'from_on_load', list: [1] };
    window.__on_load_returned = returned;
    this.data.payload = returned;
    return returned;
  }

  on_ready() {
    console.log('');
    console.log('C. on_load() MAY MUTATE NESTED DATA, AND THE RESULT IS FROZEN AGAIN:');

    window.deep_freeze_assert('on_load() nested push survived -> ' + JSON.stringify(this.data.items),
                       JSON.stringify(this.data.items) === '[1,2,3]');
    window.deep_freeze_assert('on_load() nested assignment survived -> ' + this.data.user.name,
                       this.data.user.name === 'b');

    const push_msg = window.deep_freeze_throws(() => this.data.items.push(4));
    window.deep_freeze_assert('after load, this.data.items.push(4) throws -> ' + push_msg, !!push_msg);
    window.deep_freeze_assert('after load, this.data.user.name = "c" throws',
                       !!window.deep_freeze_throws(() => { this.data.user.name = 'c'; }));
    window.deep_freeze_assert('data is unchanged by the rejected mutations -> ' + JSON.stringify(this.data.items),
                       JSON.stringify(this.data.items) === '[1,2,3]' && this.data.user.name === 'b');

    console.log('');
    console.log('D. THE OBJECT on_load() RETURNED IS NOT ALIASED INTO this.data:');

    const returned = window.__on_load_returned;
    window.deep_freeze_assert('this.data.payload is a separate object from what on_load() returned',
                       this.data.payload !== returned);
    window.deep_freeze_assert('mutating through the freeze throws',
                       !!window.deep_freeze_throws(() => this.data.payload.list.push(2)));
    window.deep_freeze_assert('the object on_load() returned is untouched -> ' + JSON.stringify(returned),
                       JSON.stringify(returned) === '{"tag":"from_on_load","list":[1]}');

    console.log('');
    console.log('E. this.args IS A STABLE READ-ONLY VIEW INSIDE on_load():');

    window.deep_freeze_assert('this.args.filter === this.args.filter inside on_load()',
                       this.data.args_identity_stable === true);
    window.deep_freeze_assert('this.args.filter.tags === this.args.filter.tags inside on_load()',
                       this.data.args_nested_identity_stable === true);
    window.deep_freeze_assert('this.args values still read through -> ' + this.data.args_value_readable,
                       this.data.args_value_readable === 'all');
  }
}
