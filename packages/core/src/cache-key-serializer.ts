/**
 * JQHTML Cache Key Serializer
 *
 * Produces a deterministic string for a plain-data argument value, so that two
 * structurally equal objects built on separate renders yield the SAME cache key.
 * Templates rebuild `{contact_id: 12}` on every render, so identity-based keying
 * can never match and permanently opts the receiving component out of caching.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT `process_for_serialization()` IN local-storage.ts. DO NOT MERGE THEM.
 *
 * That serializer stores cache VALUES and deliberately degrades: a function, a
 * symbol or a circular reference is dropped and serialization continues, because
 * losing a method while keeping the data is the right trade for a payload.
 *
 * For a cache KEY that policy manufactures false hits. Two argument objects that
 * differ ONLY by a callback would serialize identically, and a component would
 * render with another component's cached content - strictly worse than not
 * caching at all. So this serializer DECLINES on the first value it cannot
 * express exactly. It never drops anything.
 * ---------------------------------------------------------------------------
 *
 * Allow-list, and nothing else: null, undefined, boolean, number, string, Date,
 * arrays, and plain objects (prototype Object.prototype or null), in any nesting.
 * Everything else declines with a reason that reaches `data-nocache`.
 */

export type Serialize_Result =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/**
 * Values larger than this are declined rather than keyed. The supported case is a
 * handful of key/value pairs or a list of ids - not a payload. Declining loudly
 * beats spending the budget on a key nobody benefits from.
 */
export const MAX_KEY_BYTES = 500;

interface Walk_State {
  /** Ancestor path only - added on descent, removed on ascent, so a shared (non-circular) reference is fine. */
  seen: WeakSet<object>;
  size: number;
  /** Why the walk declined; set together with a null return, which unwinds every level. */
  reason: string | null;
}

/**
 * Every step returns its text, or null once the walk has declined (state.reason says
 * why). A decline is an ordinary outcome - any callback arg produces one - so it is
 * returned, not thrown: a thrown Error captured a stack trace on every such render.
 */
function decline(state: Walk_State, reason: string): null {
  state.reason = reason;
  return null;
}

function push(state: Walk_State, text: string): string | null {
  state.size += text.length;
  if (state.size > MAX_KEY_BYTES) {
    return decline(state, 'too-large');
  }
  return text;
}

/**
 * Length-prefix strings so that no combination of separators can make two
 * different structures produce the same text.
 */
function encode_string(state: Walk_State, prefix: string, value: string): string | null {
  return push(state, `${prefix}${value.length}:${value}`);
}

function walk(value: any, state: Walk_State): string | null {
  // --- primitives, each tagged so shapes cannot collide ---
  if (value === null) return push(state, 'n');
  if (value === undefined) return push(state, 'u');

  const type = typeof value;

  if (type === 'boolean') return push(state, value ? 'b1' : 'b0');
  if (type === 'number') return push(state, `d${String(value)}`);
  if (type === 'string') return encode_string(state, 's', value);

  if (type === 'function') return decline(state, 'function');
  if (type === 'symbol') return decline(state, 'symbol');
  if (type === 'bigint') return decline(state, 'bigint');
  if (type !== 'object') return decline(state, type);

  // --- objects: reject the impostors before treating anything as data ---
  if (typeof value.nodeType === 'number') return decline(state, 'dom-node');
  if (value.jquery) return decline(state, 'jquery');

  if (state.seen.has(value)) return decline(state, 'circular');
  state.seen.add(value);

  try {
    if (value instanceof Date) {
      const time = value.getTime();
      if (Number.isNaN(time)) return decline(state, 'invalid-date');
      return push(state, `t${value.toISOString()}`);
    }

    if (Array.isArray(value)) {
      // Order is meaningful - never sorted.
      const parts: string[] = [];
      if (push(state, 'a[') === null) return null;
      for (let i = 0; i < value.length; i++) {
        const part = walk(value[i], state);
        if (part === null) return null;
        parts.push(part);
      }
      if (push(state, ']') === null) return null;
      return `a[${parts.join(',')}]`;
    }

    // Plain object ONLY. A class instance, Map, Set, RegExp, Error, etc. is
    // declined: two different classes with identical fields would otherwise
    // serialize the same and collide.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return decline(state, 'non-plain-object');
    }

    // Recursive key sort - the existing top-level sort is not enough for nesting.
    const keys = Object.keys(value).sort();
    const parts: string[] = [];
    if (push(state, 'o{') === null) return null;
    for (const key of keys) {
      const encoded_key = encode_string(state, 'k', key);
      if (encoded_key === null) return null;
      const encoded_value = walk(value[key], state);
      if (encoded_value === null) return null;
      parts.push(`${encoded_key}=${encoded_value}`);
    }
    if (push(state, '}') === null) return null;
    return `o{${parts.join(',')}}`;
  } finally {
    state.seen.delete(value);
  }
}

/**
 * Serialize a value for use in a cache key.
 *
 * @returns `{ok: true, text}` when the value is exactly expressible, or
 *          `{ok: false, reason}` naming why it is not. Never throws.
 */
export function serialize_for_cache_key(value: any): Serialize_Result {
  const state: Walk_State = { seen: new WeakSet<object>(), size: 0, reason: null };
  try {
    const text = walk(value, state);
    return text === null ? { ok: false, reason: state.reason! } : { ok: true, text };
  } catch (error) {
    // A throwing getter or exotic proxy trap - decline rather than guess.
    return { ok: false, reason: 'unserializable' };
  }
}
