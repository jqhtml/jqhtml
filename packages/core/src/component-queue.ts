/**
 * JQHTML Component Lifecycle Queue
 *
 * Serializes lifecycle operations (render, reload, refresh, load) per component.
 * Replaces _create_debounced_function with a proper queue that:
 *
 * - At most one operation runs at a time per component
 * - At most one PENDING entry per type; different types queue behind each other FIFO
 * - Same-type pending operations collapse: the newest executor wins, and every
 *   collapsed caller is settled with the value of the executor that actually ran
 * - A caller is settled BEFORE the next pending entry starts
 *
 * Boot bypasses this queue entirely - it runs the lifecycle directly.
 */

interface Queue_Entry<T = any> {
  type: string;
  /** The newest executor for this type - replaced on every same-type collapse */
  executor: () => Promise<T>;
  resolvers: Array<(value: T) => void>;
  rejecters: Array<(error: any) => void>;
}

export class Component_Queue {
  /** Currently executing operation */
  private _current: { type: string } | null = null;

  /**
   * Operations waiting to run after the current one, in FIFO order.
   * At most one entry per type: a second reload() while a reload is pending
   * collapses into it, but a render() queued over a pending reload() is its
   * own entry and both run. Replacing the older entry (the previous behaviour)
   * dropped that operation entirely while still resolving its callers as if it
   * had run.
   */
  private _pending: Array<Queue_Entry> = [];

  /**
   * Enqueue a lifecycle operation.
   *
   * Behavior:
   * - Nothing running → execute immediately
   * - Something running, no pending entry of this type → queue one (FIFO)
   * - Something running, same type pending → collapse: keep every caller, but
   *   swap in the newest executor ("only the most recent call executes")
   *
   * Every caller collapsed onto one entry receives the value that entry's
   * executor returned - or its error, if it threw.
   *
   * @param type - Operation type ('render', 'reload', 'refresh', 'load')
   * @param executor - The async function to execute
   * @returns Promise that settles with the result of the execution that ran
   */
  enqueue<T>(type: string, executor: () => Promise<T>): Promise<T> {
    // If nothing running, execute immediately.
    // The Promise executor runs synchronously, so the operation's synchronous
    // prologue (_render(), the ready invalidation) still happens in the calling
    // tick, as it did before the queue existed.
    if (!this._current) {
      return new Promise<T>((resolve, reject) => {
        this._run({ type, executor, resolvers: [resolve], rejecters: [reject] });
      });
    }

    const existing = this._pending.find(entry => entry.type === type);
    if (existing) {
      // Same type already pending → collapse (fan-in).
      // The newest executor replaces the pending one: the documented rule is
      // "only the most recent call executes", and the older closure may carry
      // stale arguments. Keeping the OLD executor made two rapid `await load()`
      // calls resolve the second one `false` without ever running on_load().
      existing.executor = executor as () => Promise<any>;
      return new Promise<T>((resolve, reject) => {
        existing.resolvers.push(resolve);
        existing.rejecters.push(reject);
      });
    }

    // No pending entry of this type yet — queue one behind whatever is already waiting.
    return new Promise<T>((resolve, reject) => {
      this._pending.push({ type, executor, resolvers: [resolve], rejecters: [reject] });
    });
  }

  /**
   * Run one entry, settle its callers, then start the next pending entry.
   * @private
   */
  private _run<T>(entry: Queue_Entry<T>): void {
    // Mark busy BEFORE invoking the executor: the executor's synchronous prologue
    // can call back into enqueue(), and that call must queue rather than start a
    // second concurrent operation.
    this._current = { type: entry.type };

    const promise = (async () => {
      try {
        const value = await entry.executor();
        // Settle this entry's callers FIRST, while the queue still reads as busy.
        for (const resolve of entry.resolvers) resolve(value);
      } catch (error) {
        // A throwing executor rejects only its own callers; the queue continues.
        for (const reject of entry.rejecters) reject(error);
      }
    })();

    // The drain is deliberately OUTSIDE the awaited chain above: chaining it
    // inside made `await c.render()` also wait for a reload that was queued
    // after it.
    promise.then(() => {
      if (this._pending.length === 0) {
        // Nothing queued: release immediately, so the very common
        // `await c.reload(); c.render();` still starts the render in that tick.
        this._current = null;
        return;
      }

      // A queued entry must not start until every caller of the operation that
      // just finished has actually resumed. Those callers sit behind an unknown
      // number of microtask hops - an `async` public method adds two just by
      // returning the queue's promise - so draining on a microtask would start
      // the next on_load() before the previous caller's `await` came back. A
      // macrotask is the only boundary that is after all of them. _current stays
      // set until then, so nothing can start concurrently in the meantime.
      setTimeout(() => {
        this._current = null;
        const next = this._pending.shift();
        if (next) this._run(next);
      }, 0);
    });
  }

  /**
   * Check if any operation is currently running.
   */
  get is_busy(): boolean {
    return this._current !== null;
  }

  /**
   * Check if there's a pending operation waiting.
   */
  get has_pending(): boolean {
    return this._pending.length > 0;
  }
}
