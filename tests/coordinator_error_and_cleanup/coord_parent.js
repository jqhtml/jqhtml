class Coord_Parent extends Jqhtml_Component {
  on_render() {
    // on_render() runs after the children have been created and have already joined
    // the coordination group, but while the leader's on_load() is still in flight.
    // Changing a follower's args here is legal, and the coordinator must keep using
    // the key that follower captured when it joined - not one recomputed from these
    // new args.
    const child_b = this.$.find('.Coord_Card').eq(1).component();
    if (child_b) {
      child_b.args.filter = 'x';
    }
  }
}
