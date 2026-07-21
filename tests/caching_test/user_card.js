class User_Card extends Jqhtml_Component {
  async on_load() {
    const start_time = Date.now();
    const user_id = this.args.user_id;
    console.log(`[User_Card] on_load() START for user_id=${user_id}`);
    console.log(`[User_Card] this.data at start:`, JSON.stringify(this.data));

    // Simulate API delay (200ms)
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate fetching user data
    this.data = {
      name: `User ${user_id}`,
      email: `user${user_id}@example.com`,
      loaded: true,
      render_time: new Date().toISOString(),
      fetch_time: Date.now() - start_time
    };

    console.log(`[User_Card] on_load() END (took ${this.data.fetch_time}ms)`);
    console.log(`[User_Card] this.data at end:`, JSON.stringify(this.data));
  }

  on_ready() {
    console.log(`[User_Card ${this._cid}] on_ready() - final data:`, JSON.stringify(this.data));
  }
}
