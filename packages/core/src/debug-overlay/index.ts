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
const DEPTH_COLORS = 6;                       // keep in step with $depth-colors in _tokens.scss
const LABEL_HEIGHT = 18;
const READY_STATES = ['created', 'init', 'loaded', 'rendered', 'ready'];

interface Overlay_State {
  enabled: boolean;
  host: HTMLElement | null;
  shadow: ShadowRoot | null;
  layer: HTMLElement | null;
  modal: HTMLElement | null;
  chain: Jqhtml_Component[];
  hit_elements: Element[];
  modal_component: Jqhtml_Component | null;
}

const state: Overlay_State = {
  enabled: false,
  host: null,
  shadow: null,
  layer: null,
  modal: null,
  chain: [],
  hit_elements: [],
  modal_component: null,
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
    open_modal(component);
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

function on_mouseover(event: MouseEvent): void {
  if (is_ours(event)) return;
  const chain = chain_for(event.target);
  if (chain[0] === state.chain[0]) return;
  set_hover(chain);
}

function on_mouseout(event: MouseEvent): void {
  if (!event.relatedTarget) clear_hover();   // pointer left the document
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
  if (state.layer) state.layer.textContent = '';
}

/**
 * One tab per component in the chain, pinned to the component's top-left
 * corner and no wider than the component. Outermost first so the innermost
 * paints on top; tabs that share a corner (a child filling its parent, the
 * usual case) stack downward instead of hiding each other.
 */
function render_labels(): void {
  const layer = state.layer!;
  layer.textContent = '';
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
    label.style.left = `${left}px`;
    label.style.top = `${top + stacked * LABEL_HEIGHT}px`;
    label.style.maxWidth = `${Math.max(24, Math.round(rect.width))}px`;
    label.appendChild(el('span', 'label-name', component.component_name()));
    const args = simple_args(component);
    if (args) label.appendChild(el('span', 'label-args', args));
    layer.appendChild(label);
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
  open_modal(chain[0]);
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
}

function open_modal(component: Jqhtml_Component): void {
  const modal = state.modal!;
  modal.textContent = '';
  state.modal_component = component;
  const chain = chain_for(component.$[0]);
  const ancestors = chain.slice(1);
  const element = component.$[0] as Element;

  // Title bar
  const title = el('div', 'title');
  title.appendChild(el('span', 'title-name', `<${component.component_name()}>`));
  const log = el('button', 'button', 'Log to console') as HTMLButtonElement;
  log.addEventListener('click', () => {
    console.log(`[JQHTML debug] <${component.component_name()}>`, component, element);
  });
  title.appendChild(log);
  const close = el('button', 'button', 'Close') as HTMLButtonElement;
  close.addEventListener('click', close_modal);
  title.appendChild(close);
  modal.appendChild(title);

  // Identity
  const ctor = component.constructor as typeof Jqhtml_Component;
  const hierarchy = ctor.get_class_hierarchy ? ctor.get_class_hierarchy() : [ctor.name];
  const identity = table();
  row(identity, 'name', '', component.component_name());
  row(identity, 'class', '', hierarchy.join(' → '));
  row(identity, 'element', '', describe_element(element));
  row(identity, '_cid', '', String(component._cid));
  row(identity, 'lifecycle', '', READY_STATES[component._ready_state] || String(component._ready_state));
  const nocache = element.getAttribute('data-nocache');
  if (nocache) row(identity, 'cache', '', `declined: ${nocache}`);
  modal.appendChild(section('Identity', identity));

  // Args / data / state
  modal.appendChild(section('Args', object_table(component.args)));
  modal.appendChild(section('Data', object_table(component.data)));
  modal.appendChild(section('State', object_table(component.state)));

  // Ancestry
  const list = el('div', 'list');
  if (!ancestors.length) list.appendChild(el('div', 'empty', 'none - this is a root component'));
  for (const ancestor of ancestors) {
    const link = el('div', 'link');
    link.appendChild(el('span', 'link-name', `<${ancestor.component_name()}>`));
    link.appendChild(el('span', 'link-cid', String(ancestor._cid)));
    link.addEventListener('click', () => open_modal(ancestor));
    list.appendChild(link);
  }
  modal.appendChild(section('Ancestry (DOM, nearest first)', list));

  // Instantiator - the component whose template wrote this tag. Differs from
  // the DOM parent for markup written in a slot body or default content.
  const instantiator = component.instantiator ? component.instantiator() : null;
  const inst = el('div', 'list');
  if (instantiator) {
    const link = el('div', 'link');
    link.appendChild(el('span', 'link-name', `<${instantiator.component_name()}>`));
    link.appendChild(el('span', 'link-cid', String(instantiator._cid)));
    link.addEventListener('click', () => open_modal(instantiator));
    inst.appendChild(link);
    if (ancestors[0] && instantiator !== ancestors[0]) {
      inst.appendChild(el('div', 'note',
        'Written in this component\'s template but rendered inside a different parent (slot or default content): handlers and $sid bind here.'));
    }
  } else {
    inst.appendChild(el('div', 'empty', 'none - created directly'));
  }
  modal.appendChild(section('Instantiator', inst));

  modal.classList.add(`${PREFIX}modal-open`);
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
