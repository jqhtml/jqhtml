# viewport_resize

Validates `on_viewport_resize(viewport_width)` — the framework-owned viewport hook.

## What it demonstrates

| Group | Behavior |
|-------|----------|
| A | `Jqhtml_Component` defines `on_viewport_resize()` as a no-op stub; components that don't override it inherit it |
| B | The hook fires automatically twice per lifecycle — once after `on_render()`, once after `on_ready()` |
| C | The argument is the live `window.innerWidth` in CSS pixels |
| D | One window `resize` listener, debounced 30ms, fans out to every component in the document |
| E | A component that throws from the hook does not stop the fan-out from reaching later components |
| F | The width is re-read at dispatch time, not captured once |
| G | Stopped components are skipped; their live siblings are not |
| H | `render()` fires the hook again, and only for the component that re-rendered |

## Components

- `Viewport_Resize_Test` — root; records its own calls and runs the assertions in `on_ready()`
- `Vr_Recorder` (`alpha`, `beta`, `gamma`) — records each call tagged with the lifecycle
  phase that preceded it (`render`, `ready`, or `resize`)
- `Vr_Thrower` — always throws; sits between `alpha` and `beta` in document order
- `Vr_Plain` — template only, no JS class, so it exercises the inherited base stub

## Notes

The test runner's Chromium exposes no viewport control, so resizes are driven with
synthetic `window` `resize` events, and `window.innerWidth` is stubbed via
`Object.defineProperty` (original descriptor restored afterwards) to prove the width is
read at dispatch time.

The `[expected] Vr_Thrower always throws` console errors are intentional — they are the
error isolation in `dispatch_viewport_resize()` doing its job.

Runs in all three cache modes. Every count assertion is a delta, so the extra `on_render`
that `html` cache mode performs cannot skew a result.

## Run

```bash
cd tests/viewport_resize && ./run-test.sh
```
