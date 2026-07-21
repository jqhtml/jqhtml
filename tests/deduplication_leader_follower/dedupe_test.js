class Dedupe_Test extends Jqhtml_Component {
  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('LOAD DEDUPLICATION LEADER/FOLLOWER TEST:');
    console.log('========================================');
    console.log('');

    const tests = [];

    // TEST 1: Only one on_load for user_id=42
    console.log('TEST 1: Deduplication (user_id=42)');
    const calls_42 = window.on_load_calls[42] || 0;
    console.log(`  on_load calls for user_id=42: ${calls_42}`);
    console.log(`  Expected: 1 (leader only)`);

    if (calls_42 === 1) {
      console.log('✅ PASS: Only one on_load() executed for user_id=42');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected 1 call, got ${calls_42}`);
      tests.push(false);
    }
    console.log('');

    // TEST 2: One on_load for user_id=99
    console.log('TEST 2: Separate deduplication group (user_id=99)');
    const calls_99 = window.on_load_calls[99] || 0;
    console.log(`  on_load calls for user_id=99: ${calls_99}`);
    console.log(`  Expected: 1`);

    if (calls_99 === 1) {
      console.log('✅ PASS: Separate deduplication for user_id=99');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected 1 call, got ${calls_99}`);
      tests.push(false);
    }
    console.log('');

    // TEST 3: All three user_id=42 components have same data
    console.log('TEST 3: Followers receive leader data');

    // Find User_Card components inside wrapper divs
    const card1 = this.$sid('card1').find('.User_Card').component();
    const card2 = this.$sid('card2').find('.User_Card').component();
    const card3 = this.$sid('card3').find('.User_Card').component();

    const name1 = card1.data.name;
    const name2 = card2.data.name;
    const name3 = card3.data.name;

    console.log(`  Card 1 name: "${name1}"`);
    console.log(`  Card 2 name: "${name2}"`);
    console.log(`  Card 3 name: "${name3}"`);
    console.log(`  Expected: all "User 42"`);

    if (name1 === 'User 42' && name2 === 'User 42' && name3 === 'User 42') {
      console.log('✅ PASS: All followers received leader data');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Followers did not receive correct data');
      tests.push(false);
    }
    console.log('');

    // TEST 4: All components rendered correctly
    console.log('TEST 4: All components rendered');

    const text1 = card1.$.find('.user-name').text();
    const text2 = card2.$.find('.user-name').text();
    const text3 = card3.$.find('.user-name').text();
    const text4 = this.$sid('card4').find('.User_Card').component().$.find('.user-name').text();

    console.log(`  Rendered text (card1): "${text1}"`);
    console.log(`  Rendered text (card2): "${text2}"`);
    console.log(`  Rendered text (card3): "${text3}"`);
    console.log(`  Rendered text (card4): "${text4}"`);

    if (text1 === 'User 42' && text2 === 'User 42' &&
        text3 === 'User 42' && text4 === 'User 99') {
      console.log('✅ PASS: All components rendered correctly');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Components did not render correctly');
      tests.push(false);
    }
    console.log('');

    // TEST 5: Total on_load calls
    console.log('TEST 5: Total deduplication efficiency');
    const total_calls = Object.values(window.on_load_calls).reduce((a, b) => a + b, 0);
    console.log(`  Total on_load calls: ${total_calls}`);
    console.log(`  Expected: 2 (1 for user_id=42, 1 for user_id=99)`);
    console.log(`  Components created: 4`);
    console.log(`  Efficiency: ${total_calls} calls for 4 components`);

    if (total_calls === 2) {
      console.log('✅ PASS: Deduplication reduced 4 components to 2 on_load calls');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected 2 total calls, got ${total_calls}`);
      tests.push(false);
    }
    console.log('');

    // Final result
    console.log('========================================');
    const all_passed = tests.every(t => t);
    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
      this.$sid('results').html('<span style="color: green;">✅ All tests passed</span>');
    } else {
      console.log('❌ SOME TESTS FAILED');
      this.$sid('results').html('<span style="color: red;">❌ Some tests failed</span>');
    }
    console.log('========================================');
    console.log('');
  }
}
