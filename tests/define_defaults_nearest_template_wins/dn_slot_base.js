class Dn_Slot_Base extends Jqhtml_Component {
}

// Made global so Dn_Slot_Child can extend it: the harness inlines every dependency in its
// own try{} block, so a bare class declaration is not visible to the next one.
window.Dn_Slot_Base = Dn_Slot_Base;
