// Change detection used to compare JSON.stringify(this.data), which writes every
// Map and Set as {}. Data loaded into one therefore never counted as a change: the
// component never re-rendered with it, refresh() never re-rendered, load() returned
// false and the cache was never written. And the on_create() snapshot was a JSON
// copy, so on_load() received {} where on_create() put the Map and .set() threw.
//
// Runs in all three cache modes. Every instance gets its own `source` arg, so no
// instance hydrates from another's cache entry unless a case says so.

window.__map_sources = {
  m1: [['a', 1], ['b', 2]],
  m2: [['x', 10]],
  m3: [['p', 1]],
  m4: [['k', 'v']],
};
window.__set_sources = {
  s1: ['red', 'green'],
  s2: ['one'],
  s3: ['solo'],
  s4: ['only'],
};

class Data_Map_Set_Change_Detection extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    const stage = this.$sid('stage');
    const mount = async (name, source, assign = false) => {
      const c = $('<div>').appendTo(stage).component(name, assign ? { source, assign } : { source }).component();
      await c.ready();
      return c;
    };
    const texts = (c, sel) => c.$.find(sel).map((_, el) => $(el).text()).get().join(',');
    const cache_entry = (name, source) => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.indexOf(name) !== -1 && key.indexOf(source) !== -1 && key.indexOf('::html') === -1) return localStorage.getItem(key);
      }
      return null;
    };

    try {
      console.log('');
      console.log('A. MAP: boot renders the loaded entries');
      const map = await mount('Map_Loader', 'm1');
      assert('this.data.by_id is a Map -> ' + Object.prototype.toString.call(map.data.by_id), map.data.by_id instanceof Map);
      assert('it holds the loaded entries -> size ' + map.data.by_id.size, map.data.by_id.size === 2 && map.data.by_id.get('b') === 2);
      assert('the component re-rendered with them -> "' + texts(map, '.entry') + '"', texts(map, '.entry') === 'a=1,b=2');
      if (cache_mode === 'data') {
        const entry = cache_entry('Map_Loader', 'm1');
        assert('data mode: the loaded Map was written to the cache -> ' + entry,
               entry !== null && entry.indexOf('"__jqhtml_class__":"Map"') !== -1 && entry.indexOf('"b",2') !== -1);
      }

      console.log('');
      console.log('B. MAP: refresh() with identical contents does not re-render');
      let renders = map.state.renders, readies = map.state.readies;
      await map.refresh();
      assert('no re-render -> renders ' + renders + ' -> ' + map.state.renders, map.state.renders === renders);
      assert('no on_ready() -> readies ' + readies + ' -> ' + map.state.readies, map.state.readies === readies);
      await map.ready();
      assert('ready() still resolves after the quiet refresh', true);

      console.log('');
      console.log('C. MAP: refresh() with a changed Map re-renders');
      window.__map_sources.m1 = [['a', 1], ['b', 3]];
      renders = map.state.renders;
      await map.refresh();
      assert('re-rendered -> renders ' + renders + ' -> ' + map.state.renders, map.state.renders === renders + 1);
      assert('the DOM shows the changed entry -> "' + texts(map, '.entry') + '"', texts(map, '.entry') === 'a=1,b=3');

      console.log('');
      console.log('D. MAP: load() reports whether the Map changed');
      const unchanged = await map.load();
      assert('load() with identical contents -> ' + unchanged, unchanged === false);
      window.__map_sources.m1 = [['a', 1], ['b', 3], ['c', 4]];
      const changed = await map.load();
      assert('load() with a new entry -> ' + changed, changed === true);
      assert('this.data.by_id has it -> size ' + map.data.by_id.size, map.data.by_id.size === 3);
      if (cache_mode === 'data') {
        const entry = cache_entry('Map_Loader', 'm1');
        assert('data mode: load() wrote the changed Map to the cache', entry !== null && entry.indexOf('"c",4') !== -1);
      }

      console.log('');
      console.log('E. MAP: reload() re-renders with the current Map');
      await map.reload();
      assert('the DOM shows all three entries -> "' + texts(map, '.entry') + '"', texts(map, '.entry') === 'a=1,b=3,c=4');

      console.log('');
      console.log('F. SET: boot renders the loaded members');
      const set = await mount('Set_Loader', 's1');
      assert('this.data.tags is a Set -> ' + Object.prototype.toString.call(set.data.tags), set.data.tags instanceof Set);
      assert('it holds the loaded members -> size ' + set.data.tags.size, set.data.tags.size === 2 && set.data.tags.has('green'));
      assert('the component re-rendered with them -> "' + texts(set, '.tag') + '"', texts(set, '.tag') === 'red,green');
      if (cache_mode === 'data') {
        const entry = cache_entry('Set_Loader', 's1');
        assert('data mode: the loaded Set was written to the cache -> ' + entry,
               entry !== null && entry.indexOf('"__jqhtml_class__":"Set"') !== -1 && entry.indexOf('"green"') !== -1);
      }

      console.log('');
      console.log('G. SET: refresh() with identical members does not re-render');
      renders = set.state.renders; readies = set.state.readies;
      await set.refresh();
      assert('no re-render -> renders ' + renders + ' -> ' + set.state.renders, set.state.renders === renders);
      assert('no on_ready() -> readies ' + readies + ' -> ' + set.state.readies, set.state.readies === readies);

      console.log('');
      console.log('H. SET: refresh() with a changed Set re-renders');
      window.__set_sources.s1 = ['red', 'blue'];
      renders = set.state.renders;
      await set.refresh();
      assert('re-rendered -> renders ' + renders + ' -> ' + set.state.renders, set.state.renders === renders + 1);
      assert('the DOM shows the changed members -> "' + texts(set, '.tag') + '"', texts(set, '.tag') === 'red,blue');

      console.log('');
      console.log('I. SET: load() reports whether the Set changed');
      assert('load() with identical members -> false', (await set.load()) === false);
      window.__set_sources.s1 = ['red', 'blue', 'gold'];
      assert('load() with a new member -> true', (await set.load()) === true);
      assert('this.data.tags has it', set.data.tags.has('gold'));

      console.log('');
      console.log('J. A Map or Set that does NOT change still does not re-render at boot');
      // on_load() fills nothing new: the empty Map/Set on_create() made is the data.
      window.__map_sources.m2 = [];
      window.__set_sources.s2 = [];
      const empty_map = await mount('Map_Loader', 'm2');
      const empty_set = await mount('Set_Loader', 's2');
      assert('empty Map: rendered once -> ' + empty_map.state.renders, empty_map.state.renders === 1);
      assert('empty Set: rendered once -> ' + empty_set.state.renders, empty_set.state.renders === 1);

      console.log('');
      console.log('K. on_load() ASSIGNS a new Map / Set (no reliance on the on_create() snapshot)');
      const assigned_map = await mount('Map_Loader', 'm4', true);
      assert('assigned Map: re-rendered with its entry -> "' + texts(assigned_map, '.entry') + '" renders ' + assigned_map.state.renders,
             texts(assigned_map, '.entry') === 'k=v' && assigned_map.state.renders === 2);
      window.__map_sources.m4 = [['k', 'w']];
      let before = assigned_map.state.renders;
      await assigned_map.refresh();
      assert('assigned Map: refresh() with a changed value re-renders -> "' + texts(assigned_map, '.entry') + '"',
             assigned_map.state.renders === before + 1 && texts(assigned_map, '.entry') === 'k=w');
      window.__map_sources.m4 = [['k', 'x']];
      assert('assigned Map: load() with a changed value -> true', (await assigned_map.load()) === true);
      const assigned_set = await mount('Set_Loader', 's4', true);
      assert('assigned Set: re-rendered with its member -> "' + texts(assigned_set, '.tag') + '" renders ' + assigned_set.state.renders,
             texts(assigned_set, '.tag') === 'only' && assigned_set.state.renders === 2);
      window.__set_sources.s4 = ['other'];
      before = assigned_set.state.renders;
      await assigned_set.refresh();
      assert('assigned Set: refresh() with a changed member re-renders -> "' + texts(assigned_set, '.tag') + '"',
             assigned_set.state.renders === before + 1 && texts(assigned_set, '.tag') === 'other');

      if (cache_mode === 'data') {
        console.log('');
        console.log('L. data mode: a warm cache restores the Map and Set and the revalidation compares equal');
        const warm_map = await mount('Map_Loader', 'm1');
        const warm_set = await mount('Set_Loader', 's1');
        assert('warm Map is a Map with the cached entries -> "' + texts(warm_map, '.entry') + '"',
               warm_map.data.by_id instanceof Map && texts(warm_map, '.entry') === 'a=1,b=3,c=4');
        assert('warm Map: rendered once (cache equals fresh data) -> ' + warm_map.state.renders, warm_map.state.renders === 1);
        assert('warm Set is a Set with the cached members -> "' + texts(warm_set, '.tag') + '"',
               warm_set.data.tags instanceof Set && texts(warm_set, '.tag') === 'red,blue,gold');
        assert('warm Set: rendered once (cache equals fresh data) -> ' + warm_set.state.renders, warm_set.state.renders === 1);
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
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
