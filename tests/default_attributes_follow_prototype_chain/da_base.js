class Da_Base extends Jqhtml_Component {
}

// Made global so Da_Child can extend it: the harness inlines every dependency in its
// own try{} block, so a bare class declaration is not visible to the next one.
window.Da_Base = Da_Base;
