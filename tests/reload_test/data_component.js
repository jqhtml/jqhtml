class Data_Component extends Jqhtml_Component {
  async on_load() {
    console.log(`[Data_Component ${this._cid}] on_load() called with data_id: ${this.args.data_id}`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Simulate fetching data
    this.data = {
      data_id: this.args.data_id,
      value: `Data for ID ${this.args.data_id}`,
      timestamp: new Date().toISOString()
    };

    console.log(`[Data_Component ${this._cid}] on_load() completed:`, this.data);
  }
}
