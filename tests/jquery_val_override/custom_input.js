class Custom_Input extends Jqhtml_Component {
  val(value) {
    if (arguments.length === 0) {
      // Getter - return uppercase value
      const raw = this.$sid('input').val();
      return raw.toUpperCase();
    } else {
      // Setter - store lowercase alphanumeric, display uppercase
      const cleaned = value.toLowerCase().replace(/[^a-z0-9]/g, '');
      this.$sid('input').val(cleaned);
      this.$sid('formatted').text(cleaned.toUpperCase());
      return this.$;  // Enable chaining
    }
  }
}
