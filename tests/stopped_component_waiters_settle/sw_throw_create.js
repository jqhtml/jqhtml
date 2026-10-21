class Sw_Throw_Create extends Jqhtml_Component {
  on_create() {
    // The message is expected in the console: the boot error path logs it.
    throw new Error('Sw_Throw_Create on_create deliberately failed');
  }
}
