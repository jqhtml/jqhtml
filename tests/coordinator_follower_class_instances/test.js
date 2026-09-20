// Runs in every cache mode: the coordinator hand-off is independent of caching.
const VALID_MODES = ['none', 'data', 'html'];

class Coordinator_Follower_Class_Instances extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    try {
      const cards = ['c1', 'c2', 'c3'].map((sid) => this.$sid(sid).find('.cfc-item').component());

      console.log('');
      console.log('A. DEDUPLICATION HAPPENED (so two of the three are followers):');
      assert('three identical instances ran on_load() once -> ' + window.__cfc.on_load_done,
             window.__cfc.on_load_done === 1);

      console.log('');
      console.log('B. EVERY INSTANCE HOLDS LIVE INSTANCES, LEADER AND FOLLOWERS ALIKE:');
      cards.forEach((card, i) => {
        const d = card.data;
        const label = 'card ' + (i + 1) + ': ';
        assert(label + 'price is a Cfc_Money', d.price instanceof window.Cfc_Money);
        assert(label + 'price.format() -> ' + (d.price instanceof window.Cfc_Money && d.price.format()),
               d.price instanceof window.Cfc_Money && d.price.format() === '$12.50');
        assert(label + 'body is a Cfc_Rich_Text (toJSON class)', d.body instanceof window.Cfc_Rich_Text);
        assert(label + 'body.is_empty() is callable',
               d.body instanceof window.Cfc_Rich_Text && d.body.is_empty() === false);
        assert(label + 'model (registered without options, has toJSON) is a Cfc_Plain_Model with id -> ' +
               (d.model && d.model.id),
               d.model instanceof window.Cfc_Plain_Model && d.model.id === 7 && d.model.label() === 'model#7');
        assert(label + 'when is a Date', d.when instanceof Date && d.when.toISOString() === '2021-05-06T07:08:09.000Z');
        assert(label + 'tags is a Set', d.tags instanceof Set && d.tags.has('b'));
        assert(label + 'lookup is a Map whose value is a Cfc_Money',
               d.lookup instanceof Map && d.lookup.get('fee') instanceof window.Cfc_Money && d.lookup.get('fee').is_zero());
        assert(label + 'nested instance inside an array survived',
               d.rows[0].text instanceof window.Cfc_Rich_Text && d.rows[0].text.is_empty() === true);
      });

      console.log('');
      console.log('C. EVERY INSTANCE RENDERED BY CALLING THOSE METHODS:');
      cards.forEach((card, i) => {
        const label = 'card ' + (i + 1) + ': ';
        assert(label + 'price text -> ' + card.$.find('.price').text(), card.$.find('.price').text() === '$12.50');
        assert(label + 'body text -> ' + card.$.find('.body').text(), card.$.find('.body').text() === '<p>hi</p>');
        assert(label + 'model text -> ' + card.$.find('.model').text(), card.$.find('.model').text() === 'model#7');
        assert(label + 'nested text -> ' + card.$.find('.nested').text(), card.$.find('.nested').text() === 'no-fee');
        assert(label + 'is not stopped by a boot error', !card.$.hasClass('_Component_Stopped'));
      });

      console.log('');
      console.log('D. FOLLOWER DATA DEEP-EQUALS LEADER DATA AND SHARES NOTHING:');
      const shape = (card) => JSON.stringify(card.data);
      assert('all three serialize identically', shape(cards[0]) === shape(cards[1]) && shape(cards[1]) === shape(cards[2]));
      assert('no two share this.data', cards[0].data !== cards[1].data && cards[1].data !== cards[2].data);
      assert('no two share a nested instance', cards[0].data.body !== cards[1].data.body && cards[1].data.price !== cards[2].data.price);

      if (cache_mode === 'data') {
        console.log('');
        console.log('E. DATA MODE: A COLD RENDER REBUILDS THE INSTANCES FROM LOCALSTORAGE:');
        const stage = this.$sid('stage');
        const $late = $('<div>').appendTo(stage);
        const done_before = window.__cfc.on_load_done;
        $late.component('Cfc_Item', { item_id: 7 });

        // Poll for the first render that shows a price. With a warm cache that is the
        // cached render, and it must happen BEFORE this instance's on_load() finishes.
        const deadline = Date.now() + 2000;
        let done_at_first_price = null;
        while (Date.now() < deadline) {
          if ($late.find('.price').length) { done_at_first_price = window.__cfc.on_load_done; break; }
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        assert('the price rendered before on_load() completed (cache hit) -> on_load_done was ' + done_at_first_price,
               done_at_first_price === done_before);

        const late = $late.component();
        await late.ready();
        assert('the cached this.data holds a Cfc_Money and a Cfc_Rich_Text',
               late.data.price instanceof window.Cfc_Money && late.data.body instanceof window.Cfc_Rich_Text);
        assert('its on_load() then ran -> ' + window.__cfc.on_load_done, window.__cfc.on_load_done === done_before + 1);
        assert('the server load compared equal and did not redraw -> renders = ' + window.__cfc.render_counts[late._cid],
               window.__cfc.render_counts[late._cid] === 1);
        assert('after the load the instances are still live',
               late.data.price.format() === '$12.50' && late.data.body.is_empty() === false &&
               late.data.model instanceof window.Cfc_Plain_Model);
      }
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
