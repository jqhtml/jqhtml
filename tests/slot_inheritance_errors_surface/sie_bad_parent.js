class Sie_Bad_Parent extends Jqhtml_Component {
}

// Made global so Sie_Child can extend it: the harness inlines every dependency in its
// own try{} block, so a bare class declaration is not visible to the next one.
window.Sie_Bad_Parent = Sie_Bad_Parent;
