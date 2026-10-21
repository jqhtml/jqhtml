/**
 * Shared assertion helpers. Each dependency is inlined into its own block by the test
 * harness, so anything shared between components has to live on window.
 * Every component records into one bucket; the parent prints the summary in on_ready(),
 * which runs after every child is ready.
 */
window.freeze_holes_assert = function (name, ok) {
  (window.__freeze_holes_results = window.__freeze_holes_results || []).push({ name, ok });
};

// Returns the thrown Error message, or null when the call did NOT throw.
window.freeze_holes_throws = function (fn) {
  try {
    fn();
    return null;
  } catch (e) {
    return e.message;
  }
};
