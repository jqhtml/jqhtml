// Always throws from on_viewport_resize(). Sits between Vr_Recorder alpha and beta
// in document order, so the fan-out must survive it and still reach beta/gamma.
// The [expected] console.error output from this component is intentional.

class Vr_Thrower extends Jqhtml_Component {
  on_viewport_resize(viewport_width) {
    window.__vr.thrown++;
    throw new Error('[expected] Vr_Thrower always throws in on_viewport_resize()');
  }
}

window.jqhtml.register_component('Vr_Thrower', Vr_Thrower);
