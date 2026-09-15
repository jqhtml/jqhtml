class Bf_Bad extends Jqhtml_Component {
  async on_load() {
    await new Promise((resolve) => setTimeout(resolve, 10));
    // The message is asserted in the test: the boot error must still reach the
    // console as an error argument, not be swallowed with the rejection.
    throw new Error('Bf_Bad on_load deliberately failed');
  }
}
