/**
 * JQHTML Component Lifecycle Queue
 *
 * One lock per component. Serializes boot with render(), load(), reload() and refresh():
 *
 * - Boot is the first entry. Every entry - boot included - holds the lock from its start
 *   through the end of its own on_ready(). A call made meanwhile, including one made
 *   from inside on_ready(), waits and starts after it - unless it is awaited while that
 *   on_ready() is still running: then promote() runs it at once, nested.
 * - A call made while the lock is held waits as a pending entry; pending entries run in
 *   call order, one at a time.
 * - A new call merges only into the LAST pending entry (never the running one), and only
 *   when it has the same key (same method, same arguments). The merged caller does not
 *   run; it settles with the result of the entry it merged into. Different keys never
 *   merge: reload, refresh, reload stays three entries.
 * - A caller is settled BEFORE the next pending entry starts.
 */

export interface Queue_Entry<T = any> {
  /** Method plus arguments: 'render', 'load', 'reload' (reload(), reload(true)), 'refresh' (refresh(), reload(false)) */
  key: string;
  executor: () => Promise<T>;
  resolvers: Array<(value: T) => void>;
  rejecters: Array<(error: any) => void>;
}

export class Component_Queue {
  /**
   * True while boot or an entry holds the lock - and through the macrotask gap between a
   * finished entry and the next pending one, so nothing can jump ahead of the queue.
   */
  private _busy: boolean = false;

  /** True from begin_boot() until end_boot() */
  private _booting: boolean = false;

  /** Entries waiting for the lock, in call order */
  private _pending: Array<Queue_Entry> = [];

  /** Promoted entries still running (see promote()) */
  private _promoted_running: number = 0;

  /** The lock holder finished while promoted entries still ran; release when they end */
  private _release_deferred: boolean = false;

  /** @param _on_idle - Called whenever the lock is released with nothing waiting */
  constructor(private _on_idle: () => void) {}

  /** True while calls are waiting for the lock. */
  get has_pending(): boolean {
    return this._pending.length > 0;
  }

  /** True while a promoted entry is still running. */
  get promoted_running(): boolean {
    return this._promoted_running > 0;
  }

  /** Boot start: boot is the first entry and takes the lock. */
  begin_boot(): void {
    this._busy = true;
    this._booting = true;
  }

  /**
   * Boot ended: after its on_ready(), or early (stopped, threw, truncated lifecycle).
   * Releases the lock. Safe to call more than once.
   */
  end_boot(): void {
    if (!this._booting) return;
    this._booting = false;
    this._release();
  }

  /**
   * Run `executor` now if the component is idle, otherwise queue it.
   *
   * @param key - Method plus arguments. Only an identical key merges.
   * @param executor - The async operation. It reads this.args when it STARTS, so a
   *                   merged caller gets the newest args.
   * @returns The promise that settles with the result of the entry that ran, and the
   *          pending entry the call is waiting on (null when it started at once) - the
   *          handle promote() takes.
   */
  enqueue<T>(key: string, executor: () => Promise<T>): { promise: Promise<T>; entry: Queue_Entry<T> | null } {
    // Idle: run now. The Promise executor runs synchronously, so the operation's
    // synchronous prologue (_render(), the ready invalidation) still happens in the
    // calling tick.
    if (!this._busy) {
      const promise = new Promise<T>((resolve, reject) => {
        this._run({ key, executor, resolvers: [resolve], rejecters: [reject] });
      });
      return { promise, entry: null };
    }

    // Merge only into the immediately preceding pending entry, and only when identical.
    // A promoted entry has left _pending, so nothing can merge into it any more.
    const last = this._pending[this._pending.length - 1];
    if (last && last.key === key) {
      const promise = new Promise<T>((resolve, reject) => {
        last.resolvers.push(resolve);
        last.rejecters.push(reject);
      });
      return { promise, entry: last };
    }

    let entry!: Queue_Entry<T>;
    const promise = new Promise<T>((resolve, reject) => {
      entry = { key, executor, resolvers: [resolve], rejecters: [reject] };
      this._pending.push(entry);
    });
    return { promise, entry };
  }

  /**
   * Run a pending entry NOW, nested inside the cycle that holds the lock: the cycle's
   * on_ready() is awaiting it, and would otherwise wait forever. The entry leaves the
   * queue (so no later call merges into it); the lock stays with the running cycle. The
   * lock is not released while a promoted entry still runs, even when the cycle that
   * holds it ends first, so nothing queued can start alongside it.
   * @returns false when the entry is no longer pending (already started or promoted)
   */
  promote(entry: Queue_Entry<any>): boolean {
    const index = this._pending.indexOf(entry);
    if (index < 0) return false;
    this._pending.splice(index, 1);
    this._promoted_running++;
    this._execute(entry).then(() => {
      this._promoted_running--;
      if (this._promoted_running === 0 && this._release_deferred) {
        this._release_deferred = false;
        this._release();
      }
    });
    return true;
  }

  /**
   * Run one entry, settle its callers, then release the lock.
   * @private
   */
  private _run<T>(entry: Queue_Entry<T>): void {
    // Busy BEFORE invoking the executor: its synchronous prologue can call back into
    // enqueue(), and that call must queue rather than start a second operation.
    this._busy = true;

    // The release is deliberately OUTSIDE the awaited chain: chaining it inside made
    // `await c.render()` also wait for a reload that was queued after it.
    this._execute(entry).then(() => this._release());
  }

  /**
   * Run an entry's executor and settle its callers. Touches no lock state.
   * @private
   */
  private async _execute<T>(entry: Queue_Entry<T>): Promise<void> {
    try {
      const value = await entry.executor();
      // Settle this entry's callers FIRST, while the queue still reads as busy.
      for (const resolve of entry.resolvers) resolve(value);
    } catch (error) {
      // A throwing executor rejects only its own callers; the queue continues.
      for (const reject of entry.rejecters) reject(error);
    }
  }

  /**
   * Release the lock, or hand it to the next pending entry.
   * @private
   */
  private _release(): void {
    // A promoted entry still runs: it releases the lock when it ends (promote()).
    if (this._promoted_running > 0) {
      this._release_deferred = true;
      return;
    }

    if (this._pending.length === 0) {
      // Nothing queued: idle immediately, so the very common
      // `await c.reload(); c.render();` still starts the render in that tick.
      this._busy = false;
      this._on_idle();
      return;
    }

    // A queued entry must not start until every caller of the operation that just
    // finished has actually resumed. Those callers sit behind an unknown number of
    // microtask hops - an `async` public method adds two just by returning the queue's
    // promise - so a macrotask is the only boundary that is after all of them. _busy
    // stays true until then, so nothing can start out of order in the meantime.
    setTimeout(() => {
      const next = this._pending.shift();
      if (next) {
        this._run(next);
      } else {
        this._busy = false;
        this._on_idle();
      }
    }, 0);
  }
}

/**
 * The promise render(), load(), reload() and refresh() return when they are called while
 * one of the component's own on_loaded() or on_ready() is running.
 *
 * `await` (and any chaining) calls .then() on a non-native promise, so .then() is where
 * awaiting is seen. The first .then() runs `on_then` once: during on_ready() it pulls the
 * queued call forward so it runs at once instead of deadlocking; during on_loaded() it
 * warns (development).
 *
 * Derived promises (.then()/.catch()/.finally() results) are plain Promises.
 */
export class Lifecycle_Call_Promise<T> extends Promise<T> {
  static get [Symbol.species]() {
    return Promise;
  }

  private _on_then: (() => void) | null = null;

  /**
   * @param promise - The queued call's promise
   * @param on_then - Run once, on the first .then() (await or chain)
   */
  static wrap<T>(promise: Promise<T>, on_then: () => void): Lifecycle_Call_Promise<T> {
    const wrapped = new Lifecycle_Call_Promise<T>((resolve, reject) => {
      promise.then(resolve, reject);
    });
    wrapped._on_then = on_then;
    return wrapped;
  }

  then<R1 = T, R2 = never>(
    on_fulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    on_rejected?: ((reason: any) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    const on_then = this._on_then;
    if (on_then) {
      this._on_then = null;   // once
      on_then();
    }
    return super.then(on_fulfilled, on_rejected);
  }
}
