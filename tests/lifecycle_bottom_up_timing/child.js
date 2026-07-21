class Child_Component extends Jqhtml_Component {
  async on_ready() {
    const id = this.args.id;
    const start = Date.now();
    console.log(`[Child_${id}] on_ready() START - Time: ${start}`);

    // 1 second delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const end = Date.now();
    console.log(`[Child_${id}] on_ready() END - Time: ${end} - Duration: ${end - start}ms`);
  }
}
