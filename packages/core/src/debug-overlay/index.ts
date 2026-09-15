/**
 * Component debug overlay.
 *
 * `jqhtml.debug_overlay.enable()` turns the page into an inspector: hovering
 * any element outlines the component under the pointer and every component
 * above it, each with a small tab naming the component and its simple args;
 * clicking opens a modal describing the innermost component (identity, args,
 * data, state, ancestry, instantiator) instead of firing the click. Alt+click
 * passes through. `disable()` puts everything back.
 *
 * The labels are part of the interaction, not just decoration: the pointer can
 * move from a component onto one of its tabs without the hover set collapsing,
 * and clicking a tab inspects that tab's component. The modal keeps an amber
 * outline on whatever it is showing, and its title bar carries Parent / Back so
 * the DOM chain can be walked without going back to the page.
 *
 * Non-invasiveness, the design goal (details in ./CLAUDE.md):
 *   - The overlay's own UI lives in a shadow root on a host element appended to
 *     <body>, styled by shadow.scss. Page CSS cannot select into it and :host
 *     cuts inheritance, so its look is fixed whatever the page does.
 *   - The only thing added to application elements is a pair of classes,
 *     .jqhtml-debug-hit / .jqhtml-debug-depth-N, which light.scss paints as an
 *     inset outline (no layout effect) and only while <html data-jqhtml-debug>.
 *   - Listeners are attached on enable and removed on disable. The stylesheets
 *     and the (detached) host stay once installed: inert, and cheap to re-enable.
 *   - Nothing is registered per component, so components created after enable
 *     are covered automatically.
 */

import { Jqhtml_Component } from '../component.js';
import light_css from './light.scss';
import shadow_css from './shadow.scss';

declare const $: any;

const PREFIX = 'jqhtml-debug-';
const ROOT_ATTR = 'data-jqhtml-debug';        // on <html> while enabled - gates light.scss
const HOST_ATTR = 'data-jqhtml-debug-root';   // the shadow host
const LIGHT_STYLE_ID = 'jqhtml-debug-light-styles';
const HIT_CLASS = `${PREFIX}hit`;
const DEPTH_CLASS = `${PREFIX}depth-`;
const SELECTED_CLASS = `${PREFIX}selected`;   // on the element the modal is showing
const DEPTH_COLORS = 6;                       // keep in step with $depth-colors in _tokens.scss
const LABEL_HEIGHT = 18;
const LABEL_MIN_WIDTH = 400;                  // a narrow component still gets a readable tab
const VIEWPORT_MARGIN = 5;                    // gap kept between a label's right edge and the viewport
const READY_STATES = ['created', 'init', 'loaded', 'rendered', 'ready'];

interface Overlay_State {
  enabled: boolean;
  host: HTMLElement | null;
  shadow: ShadowRoot | null;
  layer: HTMLElement | null;
  modal: HTMLElement | null;
  chain: Jqhtml_Component[];
  hit_elements: Element[];
  /** True while the pointer sits on one of the hover labels: page hovers are ignored. */
  label_hovered: boolean;
  modal_component: Jqhtml_Component | null;
  /** Components walked away from, newest last. Non-empty <=> the Back button shows. */
  nav_stack: Jqhtml_Component[];
  /** The element currently wearing SELECTED_CLASS, so it can be stripped again. */
  selected_element: Element | null;
}

const state: Overlay_State = {
  enabled: false,
  host: null,
  shadow: null,
  layer: null,
  modal: null,
  chain: [],
  hit_elements: [],
  label_hovered: false,
  modal_component: null,
  nav_stack: [],
  selected_element: null,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const debug_overlay = {
  /** Turn the overlay on. Returns false where there is no DOM (SSR). */
  enable(): boolean {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    if (state.enabled) return true;
    install();
    if (!state.host!.isConnected) (document.body || document.documentElement).appendChild(state.host!);
    document.documentElement.setAttribute(ROOT_ATTR, '');
    document.addEventListener('mouseover', on_mouseover, true);
    document.addEventListener('mouseout', on_mouseout, true);
    document.addEventListener('click', on_click, true);
    document.addEventListener('keydown', on_keydown, true);
    document.addEventListener('scroll', on_reposition, true);
    window.addEventListener('resize', on_reposition);
    state.enabled = true;
    return true;
  },

  /** Turn the overlay off. Styles stay installed but match nothing. */
  disable(): void {
    if (!state.enabled) return;
    document.removeEventListener('mouseover', on_mouseover, true);
    document.removeEventListener('mouseout', on_mouseout, true);
    document.removeEventListener('click', on_click, true);
    document.removeEventListener('keydown', on_keydown, true);
    document.removeEventListener('scroll', on_reposition, true);
    window.removeEventListener('resize', on_reposition);
    clear_hover();
    close_modal();
    document.documentElement.removeAttribute(ROOT_ATTR);
    if (state.host && state.host.isConnected) state.host.remove();
    state.enabled = false;
  },

  is_enabled(): boolean {
    return state.enabled;
  },

  /**
   * Open the modal for a component, an element inside one, or a jQuery
   * object, without needing a click. Handy from the console and from tests.
   */
  inspect(target: any): boolean {
    if (!state.enabled) return false;
    const component = target instanceof Jqhtml_Component
      ? target
      : chain_for(target && target.jquery ? target[0] : target)[0];
    if (!component) return false;
    select(component);
    return true;
  },
};

// ---------------------------------------------------------------------------
// Installation (once)
// ---------------------------------------------------------------------------

function install(): void {
  if (state.host) return;

  if (!document.getElementById(LIGHT_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = LIGHT_STYLE_ID;
    style.textContent = light_css;
    document.head.appendChild(style);
  }

  const host = document.createElement('div');
  host.setAttribute(HOST_ATTR, '');
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = shadow_css;
  shadow.appendChild(style);

  const layer = el('div', 'layer');
  shadow.appendChild(layer);

  const modal = el('div', 'modal');
  shadow.appendChild(modal);

  state.host = host;
  state.shadow = shadow;
  state.layer = layer;
  state.modal = modal;
}

// ---------------------------------------------------------------------------
// Component chain
// ---------------------------------------------------------------------------

/** Components from the one containing `node` outward to the root. */
function chain_for(node: any): Jqhtml_Component[] {
  const chain: Jqhtml_Component[] = [];
  let element: Element | null = node instanceof Element ? node : (node && node.parentElement) || null;
  while (element) {
    const owner = element.closest('.Component');
    if (!owner) break;
    const component = $(owner).data('_component');
    if (component instanceof Jqhtml_Component && !component.$.hasClass('_Component_Stopped')) chain.push(component);
    element = owner.parentElement;
  }
  return chain;
}

function is_ours(event: Event): boolean {
  return !!state.host && event.composedPath().includes(state.host);
}

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------

/**
 * A hover on the page replaces the hover set - except while the pointer is on
 * our own UI. An event from inside the shadow host (a label, the modal) never
 * clears or changes the hover, and neither does a page hover raised while the
 * pointer is parked on a label: that is what lets a label be reached and clicked
 * without the outlines it belongs to vanishing on the way.
 */
function on_mouseover(event: MouseEvent): void {
  if (is_ours(event)) return;
  if (state.label_hovered) return;
  const chain = chain_for(event.target);
  if (chain[0] === state.chain[0]) return;
  set_hover(chain);
}

function on_mouseout(event: MouseEvent): void {
  if (!event.relatedTarget) clear_hover();   // pointer left the document
}

/**
 * The pointer left a label. If it landed back inside the component the label
 * belongs to (the usual case - the label sits on the component's own corner),
 * the hover set stays; anywhere else it goes. `elementFromPoint` reports our
 * shadow host for a point covered by another label, so the host is skipped and
 * the page element underneath is used.
 */
function on_label_leave(event: MouseEvent): void {
  state.label_hovered = false;
  const innermost = state.chain[0];
  if (!innermost) return;
  const under = element_under(event.clientX, event.clientY);
  if (!under || !(innermost.$[0] as Element).contains(under)) clear_hover();
}

function element_under(x: number, y: number): Element | null {
  const all = (document as any).elementsFromPoint;
  const candidates: Element[] = all
    ? all.call(document, x, y)
    : ([document.elementFromPoint(x, y)].filter(Boolean) as Element[]);
  for (const node of candidates) if (node !== state.host) return node;
  return null;
}

function on_reposition(): void {
  if (state.chain.length) render_labels();
}

function set_hover(chain: Jqhtml_Component[]): void {
  clear_hover();
  state.chain = chain;
  chain.forEach((component, depth) => {
    const element = component.$[0] as Element;
    element.classList.add(HIT_CLASS, DEPTH_CLASS + (depth % DEPTH_COLORS));
    state.hit_elements.push(element);
  });
  render_labels();
}

function clear_hover(): void {
  for (const element of state.hit_elements) {
    element.classList.remove(HIT_CLASS);
    for (let i = 0; i < DEPTH_COLORS; i++) element.classList.remove(DEPTH_CLASS + i);
  }
  state.hit_elements = [];
  state.chain = [];
  state.label_hovered = false;
  if (state.layer) state.layer.textContent = '';
}

/**
 * One tab per component in the chain, pinned to the component's top-left
 * corner. Width: the component's, but a narrow component still gets up to
 * LABEL_MIN_WIDTH so its name and args stay legible; a label that would then
 * run off the right edge is slid back so its right edge sits at the margin.
 * Outermost first so the innermost paints on top; tabs that share a corner (a
 * child filling its parent, the usual case) stack downward instead of hiding
 * each other.
 */
function render_labels(): void {
  const layer = state.layer!;
  layer.textContent = '';
  state.label_hovered = false;   // the element the pointer was on is gone
  const taken = new Map<string, number>();
  for (let depth = state.chain.length - 1; depth >= 0; depth--) {
    const component = state.chain[depth];
    const rect = (component.$[0] as Element).getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const left = Math.max(0, Math.round(rect.left));
    const top = Math.max(0, Math.round(rect.top));
    const key = `${left},${top}`;
    const stacked = taken.get(key) || 0;
    taken.set(key, stacked + 1);

    const label = el('div', `label ${PREFIX}depth-${depth % DEPTH_COLORS}`);
    // Laid out at the left edge FIRST, then moved. An absolutely positioned box
    // shrink-to-fits into the room its own `left` leaves, so measuring it at its
    // final position would report the squeezed width, and moving it would let it
    // re-expand - the two chase each other. At left 0 it has the whole viewport,
    // so the measurement below is the width it will actually keep.
    label.style.left = '0px';
    label.style.top = `${top + stacked * LABEL_HEIGHT}px`;
    label.style.maxWidth = `${rect.width < LABEL_MIN_WIDTH ? LABEL_MIN_WIDTH : Math.round(rect.width)}px`;
    label.appendChild(el('span', 'label-name', component.component_name()));
    const args = simple_args(component);
    if (args) label.appendChild(el('span', 'label-args', args));
    // Each label knows its own component: it is a hover target that holds the set
    // in place, and a click target that inspects THAT component, not the innermost.
    label.addEventListener('mouseenter', () => { state.label_hovered = true; });
    label.addEventListener('mouseleave', on_label_leave);
    label.addEventListener('click', (event) => {
      event.stopPropagation();   // the document handler already skips is_ours events
      select(component);
    });
    layer.appendChild(label);

    // A label on a narrow component may be wider than the component, so a component
    // near the right edge can push its label off-screen. Slide it back until its
    // right edge sits on the margin, never past the left edge.
    const width = label.getBoundingClientRect().width || label.offsetWidth;
    const limit = window.innerWidth - VIEWPORT_MARGIN;
    label.style.left = `${left + width > limit ? Math.max(0, Math.round(limit - width)) : left}px`;
  }
}

/** `$id=7 $title="Users"` - only strings, numbers and booleans, never internals. */
function simple_args(component: Jqhtml_Component): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(component.args || {})) {
    if (key.startsWith('_')) continue;
    if (typeof value === 'string') parts.push(`$${key}=${JSON.stringify(truncate(value, 24))}`);
    else if (typeof value === 'number' || typeof value === 'boolean') parts.push(`$${key}=${value}`);
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Click -> modal
// ---------------------------------------------------------------------------

function on_click(event: MouseEvent): void {
  if (is_ours(event) || event.altKey) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const chain = chain_for(event.target);
  if (!chain.length) { close_modal(); return; }
  select(chain[0]);
}

function on_keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && state.modal_component) {
    close_modal();
    event.stopPropagation();
  }
}

function close_modal(): void {
  if (!state.modal) return;
  state.modal.classList.remove(`${PREFIX}modal-open`);
  state.modal.textContent = '';
  state.modal_component = null;
  state.nav_stack = [];
  set_selected(null);
}

// ---------------------------------------------------------------------------
// Selection and navigation
//
// Three ways in, and they differ only in what they do to the navigation stack:
//   select()   - a FRESH selection (page click, label click, inspect()): the stack
//                is dropped, so Back disappears.
//   navigate() - a step along the chain (Parent, an Ancestry entry, the
//                Instantiator link): the component being left is pushed.
//   show()     - render only, stack untouched; what Back and the lifecycle
//                buttons re-open with.
// ---------------------------------------------------------------------------

function select(component: Jqhtml_Component): void {
  state.nav_stack = [];
  show(component);
}

function navigate(component: Jqhtml_Component): void {
  if (state.modal_component && state.modal_component !== component) {
    state.nav_stack.push(state.modal_component);
  }
  show(component);
}

/** Pop to the last component still alive; a stopped one is skipped, not shown. */
function go_back(): void {
  while (state.nav_stack.length) {
    const previous = state.nav_stack.pop()!;
    if (previous.$.hasClass('_Component_Stopped')) continue;
    show(previous);
    return;
  }
  if (state.modal_component) show(state.modal_component);   // nothing left: drop Back
}

/** Move SELECTED_CLASS to `element`, or take it off the page entirely for null. */
function set_selected(element: Element | null): void {
  if (state.selected_element && state.selected_element !== element) {
    state.selected_element.classList.remove(SELECTED_CLASS);
  }
  state.selected_element = element;
  if (element) element.classList.add(SELECTED_CLASS);
}

/**
 * The inspector. Three children: a fixed title bar, a scrolling body holding every
 * section, and a fixed footer of lifecycle buttons. The modal sits top-right, but
 * moves to the left when the inspected component is itself in the right half of the
 * viewport - otherwise the panel covers the thing being inspected.
 */
function show(component: Jqhtml_Component): void {
  const modal = state.modal!;
  modal.textContent = '';
  state.modal_component = component;
  const chain = chain_for(component.$[0]);
  const ancestors = chain.slice(1);
  const element = component.$[0] as Element;
  set_selected(element);

  modal.classList.toggle(
    `${PREFIX}modal-left`,
    element.getBoundingClientRect().left > window.innerWidth / 2
  );

  // Title bar: the name, then [Back] [Parent] [Log to console] [Close]. Back is
  // there only while something was navigated away from, Parent only while the
  // component has a DOM parent component - the first Ancestry entry.
  const title = el('div', 'title');
  title.appendChild(el('span', 'title-name', `<${component.component_name()}>`));
  if (state.nav_stack.length) {
    const back = el('button', 'button', 'Back') as HTMLButtonElement;
    back.addEventListener('click', go_back);
    title.appendChild(back);
  }
  const parent = ancestors[0];
  if (parent) {
    const up = el('button', 'button', 'Parent') as HTMLButtonElement;
    up.addEventListener('click', () => navigate(parent));
    title.appendChild(up);
  }
  const log = el('button', 'button', 'Log to console') as HTMLButtonElement;
  log.addEventListener('click', () => {
    console.log(`[JQHTML debug] <${component.component_name()}>`, component, element);
  });
  title.appendChild(log);
  const close = el('button', 'button', 'Close') as HTMLButtonElement;
  close.addEventListener('click', close_modal);
  title.appendChild(close);
  modal.appendChild(title);

  // The only scrolling element: the title bar and the footer stay put.
  const body = el('div', 'body');
  modal.appendChild(body);

  // Identity
  const ctor = component.constructor as typeof Jqhtml_Component;
  const hierarchy = ctor.get_class_hierarchy ? ctor.get_class_hierarchy() : [ctor.name];
  const identity = table();
  row(identity, 'name', '', component.component_name());
  row(identity, 'class', '', hierarchy.join(' → '));
  row(identity, 'element', '', describe_element(element));
  row(identity, '_cid', '', String(component._cid));
  const lifecycle = READY_STATES[component._ready_state] || String(component._ready_state);
  row(identity, 'lifecycle', '', (component as any)._debug_no_data
    ? `${lifecycle} (no data - reload w/o data)`
    : lifecycle);
  const nocache = element.getAttribute('data-nocache');
  if (nocache) row(identity, 'cache', '', `declined: ${nocache}`);
  body.appendChild(section('Identity', identity));

  // Args / data / state
  body.appendChild(section('Args', object_table(component.args)));
  body.appendChild(section('Data', object_table(component.data)));
  body.appendChild(section('State', object_table(component.state)));

  // Ancestry
  const list = el('div', 'list');
  if (!ancestors.length) list.appendChild(el('div', 'empty', 'none - this is a root component'));
  for (const ancestor of ancestors) {
    const link = el('div', 'link');
    link.appendChild(el('span', 'link-name', `<${ancestor.component_name()}>`));
    link.appendChild(el('span', 'link-cid', String(ancestor._cid)));
    link.addEventListener('click', () => navigate(ancestor));
    list.appendChild(link);
  }
  body.appendChild(section('Ancestry (DOM, nearest first)', list));

  // Instantiator - the component whose template wrote this tag. Differs from
  // the DOM parent for markup written in a slot body or default content.
  const instantiator = component.instantiator ? component.instantiator() : null;
  const inst = el('div', 'list');
  if (instantiator) {
    const link = el('div', 'link');
    link.appendChild(el('span', 'link-name', `<${instantiator.component_name()}>`));
    link.appendChild(el('span', 'link-cid', String(instantiator._cid)));
    link.addEventListener('click', () => navigate(instantiator));
    inst.appendChild(link);
    if (ancestors[0] && instantiator !== ancestors[0]) {
      inst.appendChild(el('div', 'note',
        'Written in this component\'s template but rendered inside a different parent (slot or default content): handlers and $sid bind here.'));
    }
  } else {
    inst.appendChild(el('div', 'empty', 'none - created directly'));
  }
  body.appendChild(section('Instantiator', inst));

  // Footer: lifecycle controls. Clicks land inside the shadow host, so the
  // overlay's own click hijack lets them through (is_ours).
  const footer = el('div', 'footer');
  footer.appendChild(el('span', 'footer-label', 'Lifecycle:'));
  footer.appendChild(lifecycle_button(component, 'Reload', (c) => c.reload()));
  footer.appendChild(lifecycle_button(component, 'Refresh', (c) => c.refresh()));
  footer.appendChild(lifecycle_button(component, 'Rerender', (c) => c.render()));
  footer.appendChild(lifecycle_button(component, 'Reload w/o data', (c) => (c as any)._reload_without_data()));
  modal.appendChild(footer);

  modal.classList.add(`${PREFIX}modal-open`);
}

/**
 * One footer button. Runs its lifecycle call on a live component, logs whatever it
 * throws or rejects with, and re-opens the modal once the call settles so the panel
 * (lifecycle row above all) describes the state the button just produced.
 */
function lifecycle_button(
  component: Jqhtml_Component,
  label: string,
  run: (component: Jqhtml_Component) => any,
): HTMLButtonElement {
  const button = el('button', 'button footer-button', label) as HTMLButtonElement;
  button.addEventListener('click', () => {
    if (component.$.hasClass('_Component_Stopped')) return;   // dead component: nothing to do
    let result: any;
    try {
      result = run(component);
    } catch (error) {
      console.error(`[JQHTML debug] ${label} threw on <${component.component_name()}>`, error);
      return;
    }
    Promise.resolve(result)
      .catch((error) => {
        console.error(`[JQHTML debug] ${label} rejected on <${component.component_name()}>`, error);
      })
      .then(() => {
        // `show`, not `select`: the lifecycle buttons re-render the panel in place
        // and must not throw away the navigation stack behind it.
        if (state.enabled && state.modal_component === component) show(component);
      });
  });
  return button;
}

// ---------------------------------------------------------------------------
// DOM helpers (shadow side)
// ---------------------------------------------------------------------------

function el(tag: string, classes: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = classes.split(' ').map((c) => (c.startsWith(PREFIX) ? c : PREFIX + c)).join(' ');
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(heading: string, body: HTMLElement): HTMLElement {
  const wrap = el('div', 'section');
  wrap.appendChild(el('div', 'h', heading));
  wrap.appendChild(body);
  return wrap;
}

function table(): HTMLElement {
  return el('div', 'table');
}

function row(t: HTMLElement, key: string, type: string, value: string): void {
  t.appendChild(el('span', 'key', key));
  t.appendChild(el('span', 'type', type));
  t.appendChild(el('span', 'value', value));
}

function object_table(source: any): HTMLElement {
  const entries = source && typeof source === 'object' ? Object.entries(source) : [];
  if (!entries.length) return el('div', 'empty', 'empty');
  const t = table();
  for (const [key, value] of entries) row(t, key, type_of(value), preview(value));
  return t;
}

function type_of(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value instanceof Jqhtml_Component) return 'component';
  if (value && value.jquery) return `jQuery(${value.length})`;
  if (typeof value === 'object' && value instanceof Element) return 'element';
  return typeof value;
}

function preview(value: any): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(truncate(value, 200));
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}()`;
  if (value instanceof Jqhtml_Component) return `<${value.component_name()}> ${value._cid}`;
  if (value.jquery) return value.length ? describe_element(value[0]) : 'empty';
  if (value instanceof Element) return describe_element(value);
  try {
    return truncate(JSON.stringify(value), 200);
  } catch {
    return `{${Object.keys(value).join(', ')}}`;
  }
}

function describe_element(element: Element): string {
  const id = element.id ? `#${element.id}` : '';
  const classes = element.classList.length ? `.${Array.from(element.classList).join('.')}` : '';
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
