window.coord_load_calls = window.coord_load_calls || {};   // user_id -> on_load() count
window.coord_fail_first = window.coord_fail_first || {};   // user_id -> fail the first call
window.coord_seq = window.coord_seq || 0;                  // one id per successful on_load()

class Coord_Card extends Jqhtml_Component {
  async on_load() {
    const user_id = this.args.user_id;
    window.coord_load_calls[user_id] = (window.coord_load_calls[user_id] || 0) + 1;
    const call_number = window.coord_load_calls[user_id];

    // Async on purpose: followers must have time to join before the leader settles.
    await new Promise((resolve) => setTimeout(resolve, 60));

    if (window.coord_fail_first[user_id] && call_number === 1) {
      throw new Error('Coord_Card on_load() failed for user_id=' + user_id);
    }

    window.coord_seq++;
    this.data.label = 'User ' + user_id;
    this.data.seq = window.coord_seq;     // identifies WHICH on_load() produced this data
    this.data.nested = { id: user_id };   // a nested object, for identity checks
    this.data.loaded = true;
  }
}
