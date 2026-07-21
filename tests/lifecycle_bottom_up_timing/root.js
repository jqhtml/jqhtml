class Root_Component extends Jqhtml_Component {
  async on_ready() {
    const start = Date.now();
    console.log(`[Root] on_ready() START - Time: ${start}`);

    // 1 second delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const end = Date.now();
    console.log(`[Root] on_ready() END - Time: ${end} - Duration: ${end - start}ms`);
  }
}
