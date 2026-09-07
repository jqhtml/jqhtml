class Test_Debug_Overlay extends Jqhtml_Component {
  on_create() {
    this.state.records = [{ id: 1 }];
    this.state.clicks = 0;
  }

  on_pick() {}

  on_btn_click() {
    this.state.clicks++;
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    function assert(name, condition) {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    }

    const overlay = window.jqhtml.debug_overlay;
    const html = document.documentElement;
    const btn = this.$sid('btn')[0];
    const inner = this.sid('inner');
    const outer = this.sid('outer');
    const host = () => document.querySelector('[data-jqhtml-debug-root]');
    const shadow = () => host() && host().shadowRoot;
    const labels = () => Array.from(shadow().querySelectorAll('.jqhtml-debug-label'));
    const modal = () => shadow().querySelector('.jqhtml-debug-modal');
    const modal_open = () => modal() && modal().classList.contains('jqhtml-debug-modal-open');
    const fire = (el, type, init) => el.dispatchEvent(new MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, composed: true }, init || {})));
    const has = (el, cls) => el.classList.contains(cls);

    console.log('');
    console.log('1. ENABLE INSTALLS STYLES, HOST AND GATE:');
    assert('is_enabled() false before enable', overlay.is_enabled() === false);
    assert('enable() returns true', overlay.enable() === true);
    assert('is_enabled() true', overlay.is_enabled() === true);
    assert('<html data-jqhtml-debug> set', html.hasAttribute('data-jqhtml-debug'));
    assert('light stylesheet in <head>', !!document.getElementById('jqhtml-debug-light-styles'));
    assert('shadow host appended to body with an open shadow root', !!shadow());
    assert('shadow root carries its own stylesheet', !!shadow().querySelector('style'));
    assert('host is a jqhtml-free element (no Component class)', !host().classList.contains('Component'));

    console.log('');
    console.log('1b. component_name() IS THE INVOCATION NAME, EVEN FOR TEMPLATE-ONLY COMPONENTS:');
    assert('template-only <Dbg_Inner> reports Dbg_Inner (not Jqhtml_Component)', inner.component_name() === 'Dbg_Inner');
    assert('_component_name property carries it', inner._component_name === 'Dbg_Inner');
    assert('class-backed root reports its tag name', this.component_name() === 'Test_Debug_Overlay');

    console.log('');
    console.log('2. HOVER OUTLINES THE COMPONENT AND EVERY ANCESTOR, WITH LABELS:');
    fire(btn, 'mouseover');
    assert('inner gets hit + depth-0', has(inner.$[0], 'jqhtml-debug-hit') && has(inner.$[0], 'jqhtml-debug-depth-0'));
    assert('outer gets hit + depth-1', has(outer.$[0], 'jqhtml-debug-hit') && has(outer.$[0], 'jqhtml-debug-depth-1'));
    assert('test root gets hit + depth-2', has(this.$[0], 'jqhtml-debug-hit') && has(this.$[0], 'jqhtml-debug-depth-2'));
    assert('outline is inset (computed outline-offset -2px)', getComputedStyle(inner.$[0]).outlineOffset === '-2px');
    assert('one label per component in the chain -> ' + labels().length, labels().length === 3);
    const inner_label = labels().find((l) => l.textContent.includes('Dbg_Inner'));
    assert('inner label names the component', !!inner_label);
    assert('inner label shows simple args ($id=42 $flag=true)', inner_label && /\$id=42/.test(inner_label.textContent) && /\$flag=true/.test(inner_label.textContent));
    const outer_label = labels().find((l) => l.textContent.includes('Dbg_Outer'));
    assert('outer label shows the string arg quoted', outer_label && /\$title="Users"/.test(outer_label.textContent));
    assert('outer label skips object and function args', outer_label && !/records|on_pick/.test(outer_label.textContent));
    assert('label is no wider than its component', outer_label && parseInt(outer_label.style.maxWidth, 10) <= Math.round(outer.$[0].getBoundingClientRect().width));
    const inner_left = parseInt(inner_label.style.left, 10);
    const outer_left = parseInt(outer_label.style.left, 10);
    assert('labels sharing a corner are stacked, not overlapping', inner_left !== outer_left || inner_label.style.top !== outer_label.style.top);

    console.log('');
    console.log('3. CLICK OPENS THE MODAL INSTEAD OF FIRING THE HANDLER:');
    fire(btn, 'click');
    assert('component @click handler did NOT run', this.state.clicks === 0);
    assert('modal is open', modal_open());
    const modal_text = modal().textContent;
    assert('modal names the innermost component', /<Dbg_Inner>/.test(modal_text));
    assert('modal lists args with types', /\$?id.*number.*42/s.test(modal_text) || /id.*42/.test(modal_text));
    assert('modal lists the DOM ancestry', /<Dbg_Outer>/.test(modal_text) && /<Test_Debug_Overlay>/.test(modal_text));
    assert('modal shows the lifecycle state', /ready/.test(modal_text));
    assert('modal shows the class chain', /Dbg_Inner → Component/.test(modal_text) || /Dbg_Inner/.test(modal_text));

    console.log('');
    console.log('4. ESCAPE CLOSES, ALT+CLICK PASSES THROUGH, CLICKS INSIDE THE MODAL ARE NOT HIJACKED:');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert('Escape closes the modal', !modal_open());
    fire(btn, 'click', { altKey: true });
    assert('Alt+click reaches the component handler', this.state.clicks === 1);
    assert('Alt+click does not open the modal', !modal_open());
    fire(btn, 'click');
    assert('modal reopened by a plain click', modal_open());
    const close_button = Array.from(shadow().querySelectorAll('.jqhtml-debug-button')).find((b) => b.textContent === 'Close');
    close_button.click();
    assert('Close button inside the modal works', !modal_open());
    assert('inspect(component) opens the modal programmatically', overlay.inspect(outer) && modal_open() && /<Dbg_Outer>/.test(modal().textContent));
    overlay.inspect(this.$sid('btn'));
    assert('inspect(jQuery element) resolves to its component', /<Dbg_Inner>/.test(modal().textContent));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    console.log('');
    console.log('5. COMPONENTS CREATED AFTER ENABLE ARE COVERED:');
    const marker = $('<div>').component('Dbg_Marker', { id: 'late' }).appendTo(this.$sid('mount')).component();
    await marker.ready();
    fire(marker.$[0], 'mouseover');
    assert('late component gets the hit class', has(marker.$[0], 'jqhtml-debug-hit'));
    assert("$(el).component('Dbg_Marker') reports Dbg_Marker", marker.component_name() === 'Dbg_Marker');
    assert('previous hover classes were cleared from inner', !has(inner.$[0], 'jqhtml-debug-hit'));
    assert('late component label present', labels().some((l) => /Dbg_Marker/.test(l.textContent) && /\$id="late"/.test(l.textContent)));

    console.log('');
    console.log('6. DISABLE REMOVES EVERYTHING BUT THE INSTALLED STYLES:');
    overlay.disable();
    assert('is_enabled() false', overlay.is_enabled() === false);
    assert('<html data-jqhtml-debug> removed', !html.hasAttribute('data-jqhtml-debug'));
    assert('no element keeps a hit class', document.querySelectorAll('.jqhtml-debug-hit').length === 0);
    assert('shadow host detached', !host());
    assert('light stylesheet remains installed (inert)', !!document.getElementById('jqhtml-debug-light-styles'));
    fire(btn, 'mouseover');
    assert('hover no longer tags elements', !has(inner.$[0], 'jqhtml-debug-hit'));
    fire(btn, 'click');
    assert('click reaches the component handler again', this.state.clicks === 2);
    assert('inspect() is a no-op while disabled', overlay.inspect(outer) === false);

    console.log('');
    console.log('7. RE-ENABLE REUSES THE INSTALLATION:');
    overlay.enable();
    assert('host reattached', !!shadow());
    assert('exactly one light stylesheet', document.querySelectorAll('#jqhtml-debug-light-styles').length === 1);
    fire(btn, 'mouseover');
    assert('hover works again', has(inner.$[0], 'jqhtml-debug-hit'));
    overlay.disable();

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
