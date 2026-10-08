/**
 * JQHTML DOM Attachment Tracking
 *
 * Backs the component 'attach' / 'detach' lifecycle events.
 *
 * One document-level MutationObserver (childList + subtree) is installed the first
 * time any component expresses interest in attachment, and disconnected when the
 * last interested component is stopped or collected. The observer never inspects
 * mutation records: it is only a "the tree changed" tick. On each batch it walks
 * the tracked components and asks each to compare its root's isConnected against
 * its own recorded attachment state (Jqhtml_Component._attachment_check()). Cost is
 * O(tracked components) per mutation batch, independent of how much of the page
 * changed, and zero when nothing has opted in.
 *
 * Because MutationObserver delivers per microtask, a node moved synchronously
 * (remove + insert in one task, e.g. appendTo) never shows a transition. Only a
 * component whose root is actually off-document when the batch flushes is detached.
 *
 * Tracked components are held by WeakRef. A component that is removed from the
 * document natively (never stopped) and then dropped by everything else is therefore
 * collectable: the tracker pins nothing. Dead refs are pruned on the next batch.
 */

const tracked: Set<WeakRef<any>> = new Set();
const ref_of: WeakMap<object, WeakRef<any>> = new WeakMap();
let observer: MutationObserver | null = null;

function on_mutation(): void {
  for (const ref of tracked) {
    const component = ref.deref();
    if (!component || component._stopped) {
      tracked.delete(ref);
      continue;
    }
    component._attachment_check();
  }
  if (tracked.size === 0) disconnect();
}

function connect(): void {
  if (observer !== null) return;
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  observer = new MutationObserver(on_mutation);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function disconnect(): void {
  if (observer === null) return;
  observer.disconnect();
  observer = null;
}

/** Start watching a component's root for attach/detach transitions. Idempotent. */
export function track_attachment(component: any): void {
  if (ref_of.has(component)) return;
  const ref = new WeakRef(component);
  ref_of.set(component, ref);
  tracked.add(ref);
  connect();
}

/** Stop watching a component (called from _stop()). Idempotent. */
export function untrack_attachment(component: any): void {
  const ref = ref_of.get(component);
  if (!ref) return;
  ref_of.delete(component);
  tracked.delete(ref);
  if (tracked.size === 0) disconnect();
}

/** Number of components currently tracked (diagnostics / tests). */
export function tracked_attachment_count(): number {
  return tracked.size;
}

/** Whether the document observer is currently installed (diagnostics / tests). */
export function attachment_observer_active(): boolean {
  return observer !== null;
}
