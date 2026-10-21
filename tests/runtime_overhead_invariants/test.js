// Behaviour the "Minor runtime overheads" / "Core render path performance candidates"
// changes must not alter, plus the two mechanisms a test can see: one .data() write
// per element, and no Function.prototype.bind per @click event.
class Runtime_Overhead_Invariants extends Jqhtml_Component {
  on_btn(e, element) {
    this.state.clicks = (this.state.clicks || []);
    this.state.clicks.push({ self: this, e, element });
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const jqhtml = window.jqhtml;
    const stage = this.$sid('stage');
    const make = async (cls_or_name, args = {}) => {
      const c = $('<div>').appendTo(stage).component(cls_or_name, args).component();
      await c.ready();
      return c;
    };
    const throws = (fn) => { try { fn(); return null; } catch (error) { return error; } };

    try {
      console.log('');
      console.log('A. $ AND data- ATTRIBUTES: ONE .data() WRITE, SAME STORED VALUES:');

      let multi = this.$sid('multi');
      assert('$alpha stored -> ' + multi.data('alpha'), multi.data('alpha') === 1);
      assert('$beta stored -> ' + multi.data('beta'), multi.data('beta') === 'x');
      assert('data-gamma stored and in the DOM', multi.data('gamma') === 'y' && multi.attr('data-gamma') === 'y');
      // .data(key, undefined) was always a read, so $skipped=undefined never stored a key.
      assert('$skipped=undefined stores no key', !('skipped' in multi.data()));

      // Count .data() SETTER calls on the element during a re-render.
      const real_data = $.fn.data;
      let writes = 0;
      $.fn.data = function (key, value) {
        const setter = (key !== null && typeof key === 'object') || arguments.length > 1;
        if (setter && this[0] && typeof this[0].id === 'string' && this[0].id.indexOf('multi:') === 0) writes++;
        return real_data.apply(this, arguments);
      };
      let rendered;
      try {
        rendered = this.render();
        await rendered;
      } finally {
        $.fn.data = real_data;
      }
      multi = this.$sid('multi');
      assert('one .data() write for the element\'s three values -> ' + writes, writes === 1);
      assert('values intact after re-render', multi.data('alpha') === 1 && multi.data('beta') === 'x' && multi.data('gamma') === 'y');

      console.log('');
      console.log('B. @click: HANDLER GETS (event, element) WITH this = COMPONENT, NO bind PER EVENT:');

      const real_bind = Function.prototype.bind;
      let binds = 0;
      Function.prototype.bind = function () { binds++; return real_bind.apply(this, arguments); };
      try {
        this.$sid('btn').trigger('click');
        this.$sid('btn').trigger('click');
      } finally {
        Function.prototype.bind = real_bind;
      }
      const clicks = this.state.clicks || [];
      assert('handler ran twice -> ' + clicks.length, clicks.length === 2);
      assert('this is the component', clicks.length > 0 && clicks[0].self === this);
      assert('arguments are (event, element)', clicks.length > 0 && clicks[0].e.type === 'click' &&
             clicks[0].element[0] === this.$sid('btn')[0]);
      assert('no Function.prototype.bind call per event -> ' + binds, binds === 0);

      console.log('');
      console.log('C. LIFECYCLE PROTECTION STAYS PER INSTANCE:');

      class Guarded_Widget extends Jqhtml_Component {
        on_ready() { this.state.readies = (this.state.readies || 0) + 1; }
      }
      class Field_Hook_Widget extends Jqhtml_Component {
        on_create = () => { this.state.field_hook_ran = true; };
      }
      jqhtml.register_component('Guarded_Widget', Guarded_Widget);
      jqhtml.register_component('Field_Hook_Widget', Field_Hook_Widget);
      const g1 = await make(Guarded_Widget);
      const g2 = await make(Guarded_Widget);
      const direct = throws(() => g1.on_ready());
      assert('a direct call throws and names its instance -> ' + (direct && direct.message.split('\n')[1]),
             !!direct && direct.message.indexOf(g1._cid) !== -1);
      const detached_hook = g1.on_ready;
      const unbound = throws(() => detached_hook());
      assert('an unbound call still names the instance the hook was read from',
             !!unbound && unbound.message.indexOf(g1._cid) !== -1);
      const foreign = throws(() => g1.on_ready.call(g2));
      assert('a call with another component as this names the owner, not the caller',
             !!foreign && foreign.message.indexOf(g1._cid) !== -1 && foreign.message.indexOf(g2._cid) === -1);
      assert('each instance ran its own on_ready once', g1.state.readies === 1 && g2.state.readies === 1);
      const f = await make(Field_Hook_Widget);
      assert('a hook assigned as an instance field runs', f.state.field_hook_ran === true);
      assert('and is protected too', !!throws(() => f.on_create()));

      console.log('');
      console.log('D. CSS CLASS HIERARCHY: PER CLASS, OVERRIDES STILL ASKED:');

      class Hier_Base extends Jqhtml_Component {}
      class Hier_Leaf extends Hier_Base {}
      jqhtml.register_component('Hier_Leaf', Hier_Leaf);
      const h1 = await make(Hier_Leaf);
      const h2 = await make(Hier_Leaf);
      assert('first instance has Hier_Leaf + Hier_Base -> ' + h1.$.attr('class'), h1.$.hasClass('Hier_Leaf') && h1.$.hasClass('Hier_Base'));
      assert('second instance has the same classes -> ' + h2.$.attr('class'), h2.$.attr('class') === h1.$.attr('class'));
      const listed = Hier_Leaf.get_class_hierarchy();
      listed.push('Mutated_By_Caller');
      assert('get_class_hierarchy() hands out a list the caller may change',
             Hier_Leaf.get_class_hierarchy().indexOf('Mutated_By_Caller') === -1);
      let override_calls = 0;
      Hier_Leaf.get_class_hierarchy = function () { override_calls++; return ['Hier_Patched']; };
      const h3 = await make(Hier_Leaf);
      const h4 = await make(Hier_Leaf);
      assert('a static override patched in later is used -> ' + h3.$.attr('class'), h3.$.hasClass('Hier_Patched') && !h3.$.hasClass('Hier_Base'));
      assert('and asked for every instance -> ' + override_calls, override_calls === 2 && h4.$.hasClass('Hier_Patched'));

      console.log('');
      console.log('E. TEMPLATE LOOKUP BY CLASS SEES A TEMPLATE REGISTERED LATER:');

      class Late_Tpl_Base extends Jqhtml_Component {}
      class Late_Tpl_Child extends Late_Tpl_Base {}
      jqhtml.register_component('Late_Tpl_Base', Late_Tpl_Base);
      jqhtml.register_component('Late_Tpl_Child', Late_Tpl_Child);
      const before = await make('Late_Tpl_Child');
      assert('before: default template, no late markup', before.$.find('.late-markup').length === 0);
      jqhtml.register_template({
        name: 'Late_Tpl_Base', tag: 'div',
        render: function (data, args, content, jqhtml) { const _output = new jqhtml.Markup(this); _output.p('<b class="late-markup">late</b>'); return _output; }
      });
      const after = await make('Late_Tpl_Child');
      assert('after: the ancestor template registered later renders', after.$.find('.late-markup').length === 1);

      console.log('');
      console.log('F. DEFAULT ATTRIBUTES: CHAIN FOLLOWS LATER REGISTRATION AND TEMPLATE EDITS:');

      class Late_Attr_Base extends Jqhtml_Component {}
      class Late_Attr_Child extends Late_Attr_Base {}
      jqhtml.register_component('Late_Attr_Base', Late_Attr_Base);
      jqhtml.register_component('Late_Attr_Child', Late_Attr_Child);
      const child_tpl = {
        name: 'Late_Attr_Child', tag: 'div', defaultAttributes: { title: 'child' },
        render: function (data, args, content, jqhtml) { const _output = new jqhtml.Markup(this); _output.p('child'); return _output; }
      };
      jqhtml.register_template(child_tpl);
      const a1 = await make('Late_Attr_Child');
      assert('first instance: own default only -> role=' + a1.$.attr('role'), a1.$.attr('title') === 'child' && a1.$.attr('role') === undefined);
      jqhtml.register_template({
        name: 'Late_Attr_Base', tag: 'div', defaultAttributes: { role: 'note', title: 'base' },
        render: function (data, args, content, jqhtml) { const _output = new jqhtml.Markup(this); _output.p('base'); return _output; }
      });
      const a2 = await make('Late_Attr_Child');
      assert('after the parent template registers: its role applies -> ' + a2.$.attr('role'), a2.$.attr('role') === 'note');
      child_tpl.defaultAttributes['aria-label'] = 'edited';
      const a3 = await make('Late_Attr_Child');
      assert('a default added to the template object later applies -> ' + a3.$.attr('aria-label'), a3.$.attr('aria-label') === 'edited');
      const a4 = $('<div title="invocation">').appendTo(stage).component('Late_Attr_Child', {}).component();
      await a4.ready();
      assert('an invocation attribute still beats the Define default -> ' + a4.$.attr('title'), a4.$.attr('title') === 'invocation');

      console.log('');
      console.log('G. LIFECYCLE LOGGING HOOKS STILL FIRE WHEN SWITCHED ON:');

      const seen = [];
      window.JQHTML_DEBUG = { log: (name, phase, status) => seen.push(name + ':' + phase + ':' + status), updateTree: () => {} };
      try {
        await make('Guarded_Widget');
      } finally {
        delete window.JQHTML_DEBUG;
      }
      assert('JQHTML_DEBUG.log saw construct/create/render/ready -> ' + seen.length,
             ['construct:complete', 'create:start', 'render:start', 'ready:complete'].every((s) => seen.some((x) => x === 'Guarded_Widget:' + s)));
      const real_log = console.log;
      const lines = [];
      jqhtml.debug.logCreationReady = true;
      console.log = function (...args) { lines.push(String(args[0])); };
      try {
        await make('Guarded_Widget');
      } finally {
        console.log = real_log;
        delete jqhtml.debug.logCreationReady;
      }
      assert('debug.logCreationReady logs create and ready -> ' + lines.length,
             lines.some((l) => /Guarded_Widget#\w+ → create starting/.test(l)) &&
             lines.some((l) => /Guarded_Widget#\w+ ✓ ready complete/.test(l)));
      const quiet = [];
      console.log = function (...args) { const l = String(args[0]); if (/^\[JQHTML \S+\] /.test(l)) quiet.push(l); };
      try {
        await make('Guarded_Widget');
      } finally {
        console.log = real_log;
      }
      assert('with logging off nothing is logged -> ' + JSON.stringify(quiet), quiet.length === 0);
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    window.testPassed = (failed === 0);
  }
}
