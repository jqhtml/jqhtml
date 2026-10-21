window.stop_log = window.stop_log || [];   // "<event>:<id>" entries, in order

class Stop_Wait_Child extends Jqhtml_Component {
  on_ready() { window.stop_log.push('child_on_ready:' + this._cid); }
  on_stop() { window.stop_log.push('child_on_stop:' + this._cid); }
}
