// On a resize call (once armed) stops the component in window.__vrr.victim - one that
// comes later in document order, so the dispatcher reaches it after this call.
class Vrr_Stopper extends Jqhtml_Component {
  on_viewport_resize(viewport_width) {
    window.__vrr.log.push({ key: this.args.key, phase: 'stopper', width: viewport_width });
    if (window.__vrr.armed && window.__vrr.victim && !window.__vrr.victim._stopped) {
      window.__vrr.victim.stop();
    }
  }
}
window.jqhtml.register_component('Vrr_Stopper', Vrr_Stopper);
