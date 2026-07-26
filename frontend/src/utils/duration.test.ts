import { secondsToHMS, hmsToSeconds } from './duration';

// Test basic conversions
console.log('Testing duration utility functions...');

// Test 1: 1800 seconds = 0 hours, 30 minutes, 0 seconds
const result1 = secondsToHMS(1800);
console.log(`secondsToHMS(1800):`, result1);
console.assert(
  result1.h === 0 && result1.m === 30 && result1.s === 0,
  'Expected {h:0, m:30, s:0}'
);

// Test 2: 0 hours, 30 minutes, 0 seconds = 1800 seconds
const result2 = hmsToSeconds(0, 30, 0);
console.log(`hmsToSeconds(0, 30, 0):`, result2);
console.assert(result2 === 1800, 'Expected 1800');

// Test 3: 1 hour, 15 minutes, 30 seconds
const result3 = hmsToSeconds(1, 15, 30);
const expected3 = 1 * 3600 + 15 * 60 + 30; // 4530
console.log(`hmsToSeconds(1, 15, 30):`, result3);
console.assert(result3 === expected3, `Expected ${expected3}`);

// Test 4: Reverse conversion of Test 3
const result4 = secondsToHMS(4530);
console.log(`secondsToHMS(4530):`, result4);
console.assert(
  result4.h === 1 && result4.m === 15 && result4.s === 30,
  'Expected {h:1, m:15, s:30}'
);

// Test 5: null input
const result5 = secondsToHMS(null);
console.log(`secondsToHMS(null):`, result5);
console.assert(
  result5.h === 0 && result5.m === 0 && result5.s === 0,
  'Expected {h:0, m:0, s:0}'
);

// Test 6: 0 seconds
const result6 = secondsToHMS(0);
console.log(`secondsToHMS(0):`, result6);
console.assert(
  result6.h === 0 && result6.m === 0 && result6.s === 0,
  'Expected {h:0, m:0, s:0}'
);

// Test 7: Edge case - high minutes (>60)
const result7 = hmsToSeconds(0, 90, 0);
console.log(`hmsToSeconds(0, 90, 0):`, result7);
console.assert(result7 === 5400, 'Expected 5400 (90 * 60)');

console.log('✅ All tests passed!');
