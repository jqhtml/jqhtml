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
}

class Decline extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

function push(state: Walk_State, text: string): string {
  state.size += text.length;
  if (state.size > MAX_KEY_BYTES) {
    throw new Decline('too-large');
  }
  return text;
}

/**
 * Length-prefix strings so that no combination of separators can make two
 * different structures produce the same text.
 */
function encode_string(state: Walk_State, prefix: string, value: string): string {
  return push(state, `${prefix}${value.length}:${value}`);
}

function walk(value: any, state: Walk_State): string {
  // --- primitives, each tagged so shapes cannot collide ---
  if (value === null) return push(state, 'n');
  if (value === undefined) return push(state, 'u');

  const type = typeof value;

  if (type === 'boolean') return push(state, value ? 'b1' : 'b0');
  if (type === 'number') return push(state, `d${String(value)}`);
  if (type === 'string') return encode_string(state, 's', value);

  if (type === 'function') throw new Decline('function');
  if (type === 'symbol') throw new Decline('symbol');
  if (type === 'bigint') throw new Decline('bigint');
  if (type !== 'object') throw new Decline(type);

  // --- objects: reject the impostors before treating anything as data ---
  if (typeof value.nodeType === 'number') throw new Decline('dom-node');
  if (value.jquery) throw new Decline('jquery');

  if (state.seen.has(value)) throw new Decline('circular');
  state.seen.add(value);

  try {
    if (value instanceof Date) {
      const time = value.getTime();
      if (Number.isNaN(time)) throw new Decline('invalid-date');
      return push(state, `t${value.toISOString()}`);
    }

    if (Array.isArray(value)) {
      // Order is meaningful - never sorted.
      const parts: string[] = [];
      push(state, 'a[');
      for (let i = 0; i < value.length; i++) {
        parts.push(walk(value[i], state));
      }
      push(state, ']');
      return `a[${parts.join(',')}]`;
    }

    // Plain object ONLY. A class instance, Map, Set, RegExp, Error, etc. is
    // declined: two different classes with identical fields would otherwise
    // serialize the same and collide.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Decline('non-plain-object');
    }

    // Recursive key sort - the existing top-level sort is not enough for nesting.
    const keys = Object.keys(value).sort();
    const parts: string[] = [];
    push(state, 'o{');
    for (const key of keys) {
      const encoded_key = encode_string(state, 'k', key);
      parts.push(`${encoded_key}=${walk(value[key], state)}`);
    }
    push(state, '}');
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
  const state: Walk_State = { seen: new WeakSet<object>(), size: 0 };
  try {
    return { ok: true, text: walk(value, state) };
  } catch (error) {
    if (error instanceof Decline) {
      return { ok: false, reason: error.reason };
    }
    // A throwing getter or exotic proxy trap - decline rather than guess.
    return { ok: false, reason: 'unserializable' };
  }
}
