class Caching_Test extends Jqhtml_Component {
  on_ready() {
    console.log('[Caching_Test] Scheduling delayed renders');

    // Add second component after 500ms (should use cache)
    setTimeout(() => {
      console.log('[Caching_Test] Adding second User_Card (should hit cache)');
      $('<div />').component('User_Card', {user_id: 123}).appendTo('#test2-container');
    }, 500);

    // Add third component after 1000ms (different args, cache miss)
    setTimeout(() => {
      console.log('[Caching_Test] Adding third User_Card with different args (should miss cache)');
      $('<div />').component('User_Card', {user_id: 456}).appendTo('#test3-container');
    }, 1000);
  }
}
