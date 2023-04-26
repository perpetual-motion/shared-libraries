// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.
import { describe, it } from 'mocha';
import assert, { ok } from 'node:assert';
import { ManualPromise } from '../async/manual-promise';
import { timeout } from '../async/timeout';
import { SocketMessageListener } from '../automation/sockets';
import { EventData } from '../eventing/interfaces';
import { sendMessage } from '../socket/message';
import { finalize } from '../system/finalize';
import { collectGarbage } from '../system/garbage-collector';


describe('Socket tests', async function () {
  it('listen for a message', async () => {


    assert.ok('some relevant assertion here');
    const done = new ManualPromise();
    const sml = new SocketMessageListener(9999);
    try {
      sml.subscribe({
        'this message'(event:EventData<string>) {
          console.log(`message: ${event.text}`);
          if (event.text === 'quit') {
            done.resolve();
          }
        }
      });
      // wait for the listener to be ready
      await sml.ready;

      //send the message
      sendMessage(9999, 'quit');

      // check if it was received
      await timeout(2000, done);
      ok(done.isResolved, 'Did not finish before timer expired') ;


    } finally {
      finalize(sml);
      collectGarbage();
    }
  });

});
