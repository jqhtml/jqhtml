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
    const modal_left = () => modal() && modal().classList.contains('jqhtml-debug-modal-left');
    const body = () => shadow().querySelector('.jqhtml-debug-body');
    const footer_buttons = () => Array.from(shadow().querySelectorAll('.jqhtml-debug-footer-button'));
    const button_named = (label) => footer_buttons().find((b) => b.textContent === label);
    const title_buttons = () => Array.from(shadow().querySelectorAll('.jqhtml-debug-title .jqhtml-debug-button'));
    const title_button = (label) => title_buttons().find((b) => b.textContent === label);
    const title_name = () => {
      const node = shadow().querySelector('.jqhtml-debug-title-name');
      return node ? node.textContent : '';
    };
    const label_named = (name) => labels().find((l) => l.textContent.includes(name));
    const leave_label = (label, x, y) => label.dispatchEvent(new MouseEvent('mouseleave', { clientX: Math.round(x), clientY: Math.round(y) }));
    const enter_label = (label) => label.dispatchEvent(new MouseEvent('mouseenter', {}));
    const leave_page = (el) => el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, composed: true }));
    const right_edge = (label) => label.getBoundingClientRect().right;
    const lifecycle_row = () => {
      const key = Array.from(shadow().querySelectorAll('.jqhtml-debug-key')).find((k) => k.textContent === 'lifecycle');
      return key && key.nextElementSibling ? key.nextElementSibling.nextElementSibling.textContent : '';
    };
    // Bounded poll - every wait in this suite races a timeout of its own so a hang
    // reports as a failed assertion instead of killing the harness.
    const wait_for = async (predicate, ms) => {
      const deadline = Date.now() + (ms || 1000);
      while (Date.now() < deadline) {
        if (predicate()) return true;
        await new Promise((r) => setTimeout(r, 20));
      }
      return !!predicate();
    };
    const resolves_within = (promise, ms) => Promise.race([
      promise.then(() => true, () => false),
      new Promise((r) => setTimeout(() => r(false), ms)),
    ]);
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
    const outer_width = Math.round(outer.$[0].getBoundingClientRect().width);
    const inner_width = Math.round(inner.$[0].getBoundingClientRect().width);
    assert('the wide component is wider than 400px -> ' + outer_width, outer_width > 400);
    assert('label on a component wider than 400px matches the component width', outer_label && parseInt(outer_label.style.maxWidth, 10) === outer_width);
    assert('the narrow component is narrower than 400px -> ' + inner_width, inner_width < 400);
    assert('label on a narrower component may grow to 400px', inner_label && parseInt(inner_label.style.maxWidth, 10) === 400);
    const inner_left = parseInt(inner_label.style.left, 10);
    const outer_left = parseInt(outer_label.style.left, 10);
    assert('labels sharing a corner are stacked, not overlapping', inner_left !== outer_left || inner_label.style.top !== outer_label.style.top);

    console.log('');
    console.log('2b. A LABEL NEVER RUNS OFF THE RIGHT EDGE OF THE VIEWPORT:');
    const far = this.sid('far');
    const far_el = far.$[0];
    assert('the far component sits in the right half of the viewport', far_el.getBoundingClientRect().left > window.innerWidth / 2);
    fire(far_el, 'mouseover');
    const far_label = labels().find((l) => /Dbg_Marker/.test(l.textContent));
    assert('far component gets a label', !!far_label);
    assert('far label may be wider than its 60px component', far_label && parseInt(far_label.style.maxWidth, 10) === 400);
    assert('far label right edge stays inside the viewport -> ' + (far_label && Math.round(right_edge(far_label))),
      far_label && right_edge(far_label) <= window.innerWidth - 5 + 0.5);
    assert('far label left is never negative', far_label && parseInt(far_label.style.left, 10) >= 0);
    fire(btn, 'mouseover');

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
    console.log('5. THE MODAL MOVES TO THE SIDE THE COMPONENT IS NOT ON:');
    fire(far_el, 'click');
    assert('modal opens for the far-right component', modal_open() && /<Dbg_Marker>/.test(modal().textContent));
    assert('modal moves left for a component in the right half of the viewport', modal_left());
    fire(btn, 'click');
    assert('modal opens for the left-side component', modal_open() && /<Dbg_Inner>/.test(modal().textContent));
    assert('modal stays on the right for a component in the left half', !modal_left());

    console.log('');
    console.log('6. THE MODAL SCROLLS IN ITS BODY, NOT AS A WHOLE:');
    assert('modal has a body element', !!body());
    assert('every section lives in the body', body().querySelectorAll('.jqhtml-debug-section').length >= 5);
    const body_style = getComputedStyle(body());
    assert('body scrolls vertically (overflow-y: scroll)', body_style.overflowY === 'scroll');
    const expected_max_height = Math.max(300, Math.min(600, window.innerHeight - 200));
    assert('body max-height is ' + expected_max_height + 'px -> ' + body_style.maxHeight,
      Math.round(parseFloat(body_style.maxHeight)) === expected_max_height);
    assert('body min-height is 300px -> ' + body_style.minHeight, Math.round(parseFloat(body_style.minHeight)) === 300);
    assert('the modal itself no longer scrolls', getComputedStyle(modal()).overflow === 'hidden');
    assert('title bar sits outside the scroller', modal().firstElementChild.classList.contains('jqhtml-debug-title'));
    assert('footer sits outside the scroller', modal().lastElementChild.classList.contains('jqhtml-debug-footer'));

    console.log('');
    console.log('7. THE FOOTER DRIVES THE COMPONENT LIFECYCLE:');
    const loader = this.sid('loader');
    await loader.ready();
    overlay.inspect(loader);
    const footer_label = shadow().querySelector('.jqhtml-debug-footer-label');
    assert('footer row is labelled Lifecycle:', footer_label && footer_label.textContent === 'Lifecycle:');
    assert('footer has exactly four buttons -> ' + footer_buttons().length, footer_buttons().length === 4);
    assert('footer button labels are Reload / Refresh / Rerender / Reload w/o data',
      JSON.stringify(footer_buttons().map((b) => b.textContent)) ===
      JSON.stringify(['Reload', 'Refresh', 'Rerender', 'Reload w/o data']));
    assert('loader booted with its loaded data', /loaded: yes/.test(loader.$.text()));

    const loads_before = loader.state.load_count;
    button_named('Reload w/o data').click();
    assert('Reload w/o data re-renders from the on_create() state',
      await wait_for(() => /loaded: no/.test(loader.$.text()), 1000));
    assert('Reload w/o data did not run on_load() -> ' + loader.state.load_count,
      loader.state.load_count === loads_before);
    assert('component is ready again within 1s', await resolves_within(loader.ready(), 1000));
    assert('lifecycle row reports the no-data state',
      await wait_for(() => /no data/.test(lifecycle_row()), 1000));

    button_named('Reload').click();
    assert('Reload loads the component fully again',
      await wait_for(() => /loaded: yes/.test(loader.$.text()), 1000));
    assert('Reload ran on_load() once more -> ' + loader.state.load_count,
      loader.state.load_count === loads_before + 1);
    assert('component is ready within 1s after Reload', await resolves_within(loader.ready(), 1000));
    assert('lifecycle row is back to plain ready',
      await wait_for(() => /ready/.test(lifecycle_row()) && !/no data/.test(lifecycle_row()), 1000));

    button_named('Refresh').click();
    assert('Refresh settles within 1s and leaves the component alive',
      (await resolves_within(loader.ready(), 1000)) && !loader.$.hasClass('_Component_Stopped'));
    button_named('Rerender').click();
    assert('Rerender settles within 1s and leaves the component alive',
      (await resolves_within(loader.ready(), 1000)) && !loader.$.hasClass('_Component_Stopped'));
    assert('loader still shows its loaded data after Refresh and Rerender', /loaded: yes/.test(loader.$.text()));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    console.log('');
    console.log('8. COMPONENTS CREATED AFTER ENABLE ARE COVERED:');
    const marker = $('<div>').component('Dbg_Marker', { id: 'late' }).appendTo(this.$sid('mount')).component();
    await marker.ready();
    fire(marker.$[0], 'mouseover');
    assert('late component gets the hit class', has(marker.$[0], 'jqhtml-debug-hit'));
    assert("$(el).component('Dbg_Marker') reports Dbg_Marker", marker.component_name() === 'Dbg_Marker');
    assert('previous hover classes were cleared from inner', !has(inner.$[0], 'jqhtml-debug-hit'));
    assert('late component label present', labels().some((l) => /Dbg_Marker/.test(l.textContent) && /\$id="late"/.test(l.textContent)));

    console.log('');
    console.log('8b. HOVER LABELS ARE STICKY AND CLICKABLE:');
    fire(btn, 'mouseover');
    assert('hover set established on the inner component', has(inner.$[0], 'jqhtml-debug-hit') && labels().length === 3);
    let sticky_label = label_named('Dbg_Inner');
    const label_style = getComputedStyle(sticky_label);
    assert('a label catches the mouse (pointer-events: auto)', label_style.pointerEvents === 'auto');
    assert('a label advertises itself as clickable (cursor: pointer)', label_style.cursor === 'pointer');
    assert('the labels layer itself stays transparent to the mouse',
      getComputedStyle(shadow().querySelector('.jqhtml-debug-layer')).pointerEvents === 'none');
    fire(sticky_label, 'mouseover');
    assert('moving the pointer onto a label keeps the outlines',
      has(inner.$[0], 'jqhtml-debug-hit') && has(outer.$[0], 'jqhtml-debug-hit'));
    assert('moving the pointer onto a label keeps the labels', labels().length === 3);
    enter_label(sticky_label);
    fire(outer.$[0], 'mouseover');
    assert('a page hover is ignored while the pointer sits on a label',
      has(inner.$[0], 'jqhtml-debug-hit') && has(inner.$[0], 'jqhtml-debug-depth-0') && labels().length === 3);
    const btn_rect = btn.getBoundingClientRect();
    leave_label(sticky_label, btn_rect.left + btn_rect.width / 2, btn_rect.top + btn_rect.height / 2);
    assert('leaving a label back onto its own component keeps the hover set',
      has(inner.$[0], 'jqhtml-debug-hit') && labels().length === 3);
    const outer_rect = outer.$[0].getBoundingClientRect();
    const inner_rect = inner.$[0].getBoundingClientRect();
    sticky_label = label_named('Dbg_Inner');
    enter_label(sticky_label);
    leave_label(sticky_label, outer_rect.right - 5, inner_rect.top + inner_rect.height / 2);
    assert('leaving a label onto an element outside that component clears the hover set',
      !has(inner.$[0], 'jqhtml-debug-hit') && labels().length === 0);

    console.log('');
    console.log('8c. CLICKING A LABEL INSPECTS THAT LABEL\'S COMPONENT:');
    fire(btn, 'mouseover');
    const clicks_before_label = this.state.clicks;
    label_named('Dbg_Inner').click();
    assert('the modal opens for the clicked label\'s component', modal_open() && title_name() === '<Dbg_Inner>');
    assert('the page click handler did not run', this.state.clicks === clicks_before_label);
    assert('the inspected element carries the selection class', has(inner.$[0], 'jqhtml-debug-selected'));
    assert('a label click is a fresh selection, so there is no Back button', !title_button('Back'));

    console.log('');
    console.log('8d. PARENT / BACK NAVIGATION IN THE TITLE BAR:');
    assert('a nested component offers Parent', !!title_button('Parent'));
    assert('title bar button order is Back? Parent? Log to console, Close',
      JSON.stringify(title_buttons().map((b) => b.textContent)) ===
      JSON.stringify(['Parent', 'Log to console', 'Close']));
    title_button('Parent').click();
    assert('Parent opens the DOM parent component', title_name() === '<Dbg_Outer>');
    assert('Back appears once something has been navigated away from', !!title_button('Back'));
    assert('the selection outline moved to the parent',
      has(outer.$[0], 'jqhtml-debug-selected') && !has(inner.$[0], 'jqhtml-debug-selected'));
    title_button('Parent').click();
    assert('Parent again reaches the root component', title_name() === '<Test_Debug_Overlay>');
    assert('the root component offers no Parent', !title_button('Parent'));
    assert('Back is still offered two steps in', !!title_button('Back'));
    title_button('Back').click();
    assert('Back returns to the previous component', title_name() === '<Dbg_Outer>');
    assert('Back is still offered one step in', !!title_button('Back'));
    title_button('Back').click();
    assert('Back returns to where the walk started', title_name() === '<Dbg_Inner>');
    assert('Back disappears at the first component', !title_button('Back'));
    assert('the selection outline came back with it',
      has(inner.$[0], 'jqhtml-debug-selected') && !has(outer.$[0], 'jqhtml-debug-selected'));
    const ancestry_link = Array.from(shadow().querySelectorAll('.jqhtml-debug-link')).find((l) => /Dbg_Outer/.test(l.textContent));
    assert('the Ancestry list offers the parent', !!ancestry_link);
    ancestry_link.click();
    assert('clicking an Ancestry entry is a navigation', title_name() === '<Dbg_Outer>' && !!title_button('Back'));
    fire(btn, 'click');
    assert('a fresh page click resets the navigation stack',
      title_name() === '<Dbg_Inner>' && !title_button('Back'));

    console.log('');
    console.log('9. THE INSPECTED COMPONENT KEEPS AN AMBER OUTLINE:');
    leave_page(btn);
    assert('the hover set is gone', !has(inner.$[0], 'jqhtml-debug-hit'));
    assert('clearing the hover does not clear the selection', has(inner.$[0], 'jqhtml-debug-selected'));
    assert('the selected component is outlined amber -> ' + getComputedStyle(inner.$[0]).outlineColor,
      getComputedStyle(inner.$[0]).outlineColor === 'rgb(180, 83, 9)');
    fire(btn, 'mouseover');
    assert('the hover outline wins over the selection outline -> ' + getComputedStyle(inner.$[0]).outlineColor,
      getComputedStyle(inner.$[0]).outlineColor === 'rgb(229, 50, 45)');
    leave_page(btn);
    assert('the amber outline returns once the hover ends', getComputedStyle(inner.$[0]).outlineColor === 'rgb(180, 83, 9)');
    title_button('Close').click();
    assert('closing the inspector removes the selection class', !has(inner.$[0], 'jqhtml-debug-selected'));
    assert('no element is left selected', document.querySelectorAll('.jqhtml-debug-selected').length === 0);

    console.log('');
    console.log('10. DISABLE REMOVES EVERYTHING BUT THE INSTALLED STYLES:');
    overlay.inspect(inner);
    assert('inspect() selects the component it opens', has(inner.$[0], 'jqhtml-debug-selected'));
    overlay.disable();
    assert('is_enabled() false', overlay.is_enabled() === false);
    assert('<html data-jqhtml-debug> removed', !html.hasAttribute('data-jqhtml-debug'));
    assert('no element keeps a hit class', document.querySelectorAll('.jqhtml-debug-hit').length === 0);
    assert('disable() removes the selection class', document.querySelectorAll('.jqhtml-debug-selected').length === 0);
    assert('shadow host detached', !host());
    assert('light stylesheet remains installed (inert)', !!document.getElementById('jqhtml-debug-light-styles'));
    fire(btn, 'mouseover');
    assert('hover no longer tags elements', !has(inner.$[0], 'jqhtml-debug-hit'));
    fire(btn, 'click');
    assert('click reaches the component handler again', this.state.clicks === 2);
    assert('inspect() is a no-op while disabled', overlay.inspect(outer) === false);

    console.log('');
    console.log('11. RE-ENABLE REUSES THE INSTALLATION:');
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
