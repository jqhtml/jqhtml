/**
 * JQHTML Component Lifecycle Queue
 *
 * Serializes lifecycle operations (render, reload, refresh) per component.
 * Replaces _create_debounced_function with a proper queue that:
 *
 * - At most one operation runs at a time per component
 * - At most one operation is pending (waiting for the current to finish)
 * - Same-type pending operations collapse (fan-in: all callers share one execution)
 * - Different-type pending operations: new replaces old (old callers get the new result)
 *
 * Boot bypasses this queue entirely - it runs the lifecycle directly.
 */

interface Queue_Entry {
  type: string;
  executor: () => Promise<void>;
  resolvers: Array<(value: void) => void>;
  rejecters: Array<(error: any) => void>;
}

export class Component_Queue {
  /** Currently executing operation */
  private _current: { type: string; promise: Promise<void> } | null = null;

  /** Next operation waiting to execute after current completes */
  private _pending: Queue_Entry | null = null;

  /**
   * Enqueue a lifecycle operation.
   *
   * Behavior:
   * - Nothing running → execute immediately
   * - Something running, no pending → create pending entry
   * - Something running, same type pending → collapse (share pending promise)
   * - Something running, different type pending → replace pending (all callers get new result)
   *
   * @param type - Operation type ('render', 'reload', 'refresh', 'load')
   * @param executor - The async function to execute
   * @returns Promise that resolves when the operation completes
   */
  enqueue(type: string, executor: () => Promise<void>): Promise<void> {
    // If nothing running, execute immediately
    if (!this._current) {
      return this._execute(type, executor);
    }

    // Something is running — add to pending
    if (this._pending) {
      if (this._pending.type === type) {
        // Same type pending → collapse (fan-in)
        // All callers share the same future execution
        return new Promise<void>((resolve, reject) => {
          this._pending!.resolvers.push(resolve);
          this._pending!.rejecters.push(reject);
        });
      } else {
        // Different type pending → replace
        // Old pending callers join the new operation
        // (their operation was superseded by a different type)
        const old_resolvers = this._pending.resolvers;
        const old_rejecters = this._pending.rejecters;

        return new Promise<void>((resolve, reject) => {
          this._pending = {
            type,
            executor,
            resolvers: [...old_resolvers, resolve],
            rejecters: [...old_rejecters, reject]
          };
        });
      }
    }

    // No pending entry yet — create one
    return new Promise<void>((resolve, reject) => {
      this._pending = {
        type,
        executor,
        resolvers: [resolve],
        rejecters: [reject]
      };
    });
  }

  /**
   * Execute an operation and handle pending queue after completion.
   * @private
   */
  private _execute(type: string, executor: () => Promise<void>): Promise<void> {
    const promise = (async () => {
      try {
        await executor();
      } finally {
        this._current = null;

        // Run pending if exists
        if (this._pending) {
          const pending = this._pending;
          this._pending = null;

          try {
            await this._execute(pending.type, pending.executor);
            for (const resolve of pending.resolvers) resolve();
          } catch (err) {
            for (const reject of pending.rejecters) reject(err);
          }
        }
      }
    })();

    this._current = { type, promise };
    return promise;
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
    return this._pending !== null;
  }
}
