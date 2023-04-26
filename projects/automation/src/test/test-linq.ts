// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import * as assert from 'assert';
import { describe, it } from 'mocha';
import { length, linq } from '../system/linq';

const anArray = ['A', 'B', 'C', 'D', 'E'];

describe('Linq', () => {
  it('distinct selects unique items', async () => {

    const items = ['one', 'two', 'two', 'three'];
    const distinct = linq.values(items).distinct().toArray();
    assert.strictEqual(length(distinct), 3);

    const dic = {
      happy: 'hello',
      sad: 'hello',
      more: 'name',
      maybe: 'foo',
    };

    const result = linq.values(dic).distinct().toArray();
    assert.strictEqual(length(distinct), 3);
  });

  it('iterating thru collections', async () => {
    // items are items.
    assert.strictEqual([...linq.values(anArray)].join(','), anArray.join(','));
    assert.strictEqual(linq.values(anArray).count(), 5);
  });
});
