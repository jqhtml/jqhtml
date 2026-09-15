// on_load() may touch nothing but this.args/this.data, and on_render() must not write
// to this.data, so the observations this test needs live on a window-level tally.
window.__uc = window.__uc || { loads: [], first_render: [] };

class User_Card extends Jqhtml_Component {
  async on_load() {
    const user_id = this.args.user_id;
    window.__uc.loads.push(user_id);
    console.log(`[User_Card] on_load() START for user_id=${user_id}`);

    // Simulate API delay (200ms)
    await new Promise(resolve => setTimeout(resolve, 200));

    this.data = {
      name: `User ${user_id}`,
      email: `user${user_id}@example.com`,
      loaded: true,
      render_time: new Date().toISOString()
    };

    console.log(`[User_Card] on_load() END for user_id=${user_id}`);
  }

  on_render() {
    if (this.state.first_render_seen) return;
    this.state.first_render_seen = true;
    // Was the FIRST paint already populated? That is what a cache hit buys.
    window.__uc.first_render.push({ user_id: this.args.user_id, loaded: !!this.data.loaded });
  }
}
