import { rollUpTotals } from './rollup.js';

// Test tree:
// 20.            own objects: 100.00
//   20.11.       own objects:  10.00
//     20.11.10.  own objects:   4.50
// 30.            own objects: 850.00
// 40.            no objects
const tree = [
  { id: 'a20', parentId: null },
  { id: 'a2011', parentId: 'a20' },
  { id: 'a201110', parentId: 'a2011' },
  { id: 'a30', parentId: null },
  { id: 'a40', parentId: null },
];

const direct = new Map([
  ['a20', '100.00'],
  ['a2011', '10.00'],
  ['a201110', '4.50'],
  ['a30', '850.00'],
]);

describe('rollUpTotals', () => {
  const totals = rollUpTotals(tree, direct);

  it('includes objects on the article itself and on every descendant', () => {
    expect(totals.get('a20')?.toFixed(2)).toBe('114.50');
    expect(totals.get('a2011')?.toFixed(2)).toBe('14.50');
    expect(totals.get('a201110')?.toFixed(2)).toBe('4.50');
  });

  it('keeps separate branches separate', () => {
    expect(totals.get('a30')?.toFixed(2)).toBe('850.00');
  });

  it('gives an article without objects a total of zero', () => {
    expect(totals.get('a40')?.toFixed(2)).toBe('0.00');
  });

  it('adds decimals exactly, unlike floating point', () => {
    // In plain JavaScript, 0.1 + 0.2 === 0.30000000000000004
    const result = rollUpTotals(
      [
        { id: 'p', parentId: null },
        { id: 'c', parentId: 'p' },
      ],
      new Map([
        ['p', '0.1'],
        ['c', '0.2'],
      ]),
    );
    expect(result.get('p')?.toString()).toBe('0.3');
  });

  it('refuses to loop forever on a cycle', () => {
    const cyclic = [
      { id: 'x', parentId: 'y' },
      { id: 'y', parentId: 'x' },
    ];
    expect(() => rollUpTotals(cyclic, new Map())).toThrow(/Cycle/);
  });
});