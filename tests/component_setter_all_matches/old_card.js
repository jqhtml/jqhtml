class Old_Card extends Jqhtml_Component {
  on_stop() {
    window.__old_stopped = (window.__old_stopped || 0) + 1;
  }
}
