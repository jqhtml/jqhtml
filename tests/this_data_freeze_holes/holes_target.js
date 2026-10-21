// No on_load(): the case where this.data kept on_create()'s raw objects.
class Holes_Target extends Jqhtml_Component {
  on_create() {
    // The aliasing pattern: one array held by both this.state and this.data.
    this.state.list = this.data.list = [];
    this.data.user = { name: 'a' };
    this.data.items = [1, 2];
    this.data.nested = { list: [{ id: 1 }] };
    // Unfrozen, Object.defineProperty is an ordinary write and must keep working.
    Object.defineProperty(this.data, 'defined', { value: 5, enumerable: true, writable: true, configurable: true });
    this.state.snapshot = JSON.stringify(this.data);
  }

  on_ready() {
    const assert = window.freeze_holes_assert;
    const throws = window.freeze_holes_throws;
    const names = (msg, path) => !!msg && msg.includes(path);

    console.log('');
    console.log('A. EVERY MUTATION ROUTE THROWS WHILE FROZEN (top level):');

    let msg = throws(() => Object.defineProperty(this.data, 'x', { value: 1 }));
    assert('Object.defineProperty(this.data, "x") throws, naming this.data.x -> ' + msg, names(msg, 'this.data.x'));
    msg = throws(() => Reflect.defineProperty(this.data, 'x', { value: 1 }));
    assert('Reflect.defineProperty(this.data, "x") throws -> ' + msg, names(msg, 'this.data.x'));
    msg = throws(() => Object.setPrototypeOf(this.data, null));
    assert('Object.setPrototypeOf(this.data, null) throws -> ' + msg, names(msg, 'this.data'));
    msg = throws(() => Object.preventExtensions(this.data));
    assert('Object.preventExtensions(this.data) throws -> ' + msg, names(msg, 'this.data'));
    msg = throws(() => Object.freeze(this.data));
    assert('Object.freeze(this.data) throws -> ' + msg, !!msg);
    msg = throws(() => { delete this.data.user; });
    assert('delete this.data.user still throws -> ' + msg, names(msg, 'this.data.user'));
    msg = throws(() => { this.data.user = {}; });
    assert('this.data.user = {} still throws -> ' + msg, names(msg, 'this.data.user'));

    console.log('');
    console.log('B. EVERY MUTATION ROUTE THROWS WHILE FROZEN (nested):');

    msg = throws(() => Object.defineProperty(this.data.user, 'y', { value: 1 }));
    assert('Object.defineProperty(this.data.user, "y") throws, naming this.data.user.y -> ' + msg,
           names(msg, 'this.data.user.y'));
    msg = throws(() => Object.defineProperty(this.data.items, '0', { value: 9 }));
    assert('Object.defineProperty(this.data.items, "0") throws, naming this.data.items[0] -> ' + msg,
           names(msg, 'this.data.items[0]'));
    msg = throws(() => Object.setPrototypeOf(this.data.items, null));
    assert('Object.setPrototypeOf(this.data.items, null) throws, naming this.data.items -> ' + msg,
           names(msg, 'this.data.items'));
    msg = throws(() => Object.preventExtensions(this.data.nested.list[0]));
    assert('Object.preventExtensions(this.data.nested.list[0]) throws, naming it -> ' + msg,
           names(msg, 'this.data.nested.list[0]'));
    msg = throws(() => Object.freeze(this.data.user));
    assert('Object.freeze(this.data.user) throws -> ' + msg, names(msg, 'this.data.user'));
    msg = throws(() => Object.seal(this.data.items));
    assert('Object.seal(this.data.items) throws -> ' + msg, names(msg, 'this.data.items'));
    msg = throws(() => { delete this.data.user.name; });
    assert('delete this.data.user.name still throws -> ' + msg, names(msg, 'this.data.user.name'));

    console.log('');
    console.log('C. A PROPERTY DESCRIPTOR HANDS OUT THE READ-ONLY VIEW, NOT THE RAW OBJECT:');

    msg = throws(() => Object.getOwnPropertyDescriptor(this.data, 'items').value.push(3));
    assert('getOwnPropertyDescriptor(this.data, "items").value.push(3) throws, naming this.data.items[2] -> ' + msg,
           names(msg, 'this.data.items[2]'));
    msg = throws(() => { Object.getOwnPropertyDescriptors(this.data.nested).list.value[0].id = 2; });
    assert('getOwnPropertyDescriptors(this.data.nested).list.value[0].id = 2 throws, naming this.data.nested.list[0].id -> ' + msg,
           names(msg, 'this.data.nested.list[0].id'));
    assert('the descriptor value is the same view a read returns',
           Object.getOwnPropertyDescriptor(this.data, 'items').value === this.data.items);

    console.log('');
    console.log('D. ERROR MESSAGES NAME THE FULL PATH:');

    msg = throws(() => { this.data.nested.list[0].id = 2; });
    assert('this.data.nested.list[0].id = 2 names this.data.nested.list[0].id -> ' + msg,
           names(msg, 'this.data.nested.list[0].id'));
    msg = throws(() => this.data.nested.list.push({}));
    assert('this.data.nested.list.push({}) names this.data.nested.list[1] -> ' + msg,
           names(msg, 'this.data.nested.list[1]'));

    console.log('');
    console.log('E. on_create() ALIASING CANNOT REACH FROZEN DATA (no on_load()):');

    let alias_msg = throws(() => this.state.list.push('x'));
    assert('this.state.list.push("x") is allowed (this.state is unrestricted) -> ' + alias_msg, alias_msg === null);
    assert('this.state.list now has 1 item', this.state.list.length === 1);
    assert('this.data.list is still empty -> ' + JSON.stringify(this.data.list), this.data.list.length === 0);
    assert('this.data.list is not the array this.state holds', this.data.list !== this.state.list);

    console.log('');
    console.log('F. READS AND UNFROZEN WRITES ARE UNCHANGED:');

    assert('Object.defineProperty in on_create() survived -> ' + this.data.defined, this.data.defined === 5);
    assert('JSON.stringify(this.data) still equals the on_create() value -> ' + JSON.stringify(this.data),
           JSON.stringify(this.data) === this.state.snapshot);
    assert('spread of this.data keeps every key',
           JSON.stringify(Object.keys({ ...this.data })) === JSON.stringify(Object.keys(JSON.parse(this.state.snapshot))));
    assert('Array.isArray(this.data.items)', Array.isArray(this.data.items));
    assert('this.data.items === this.data.items', this.data.items === this.data.items);
    assert('the template rendered on_create() data -> ' + this.$.text().trim(),
           this.$.text().trim() === 'holes: a / 0 listed');
  }
}
