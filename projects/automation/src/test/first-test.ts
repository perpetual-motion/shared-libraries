// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.
import { describe, it } from 'mocha';
import assert from 'node:assert';

describe('Ensure tests are actually working', async () => {
  // before(() => out('about to run some test'));

  it('is a subtest', () => {
    assert.ok('some relevant assertion here');
  });

  it('is not failing subtest', () => {
    assert.ok(true, 'looks ok');
    // assert.ok(false,'some relevant assertion here');
  });
});

