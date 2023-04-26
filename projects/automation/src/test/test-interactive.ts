// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.
import { describe, it } from 'mocha';
import { ManualPromise } from '../async/manual-promise';
import { Program } from '../automation/program';
import { SocketListener } from '../automation/sockets';
import { notifications } from '../eventing/names';
import { finalize } from '../system/finalize';

/** These tests require interactivity to function
 *
 *  and are designed to only be run manually
 */
describe(' Interactive Tests', async function () {

  /** Listens for connections and connects all viewers up to the same process
   * (everyone shares the output of the process, anyone can send commands.)
   */
  it.skip('Expose a process to multiple sockets', async () => {
    const done = new ManualPromise();

    const listener = new SocketListener(9998);
    try {
      const cmd = await new Program('c:\\windows\\system32\\cmd.exe');
      const proc = await cmd();

      listener.on(notifications.connected, ({data:socketStream}) => {
        socketStream.pipe(proc.console);

        socketStream.on(notifications.read,async (event)=> {
          if (event.text === 'exit') {
            await proc.writeln('exit');
            finalize(proc);
            finalize(socketStream);
            done.resolve();
          }
        });
      });
      await done;
    }
    finally {
      finalize(listener);
    }
  });


  it.skip('loopback - pipe socket back to client',async() => {
    const sl = new SocketListener(9998);
    try {

      const done = new ManualPromise();

      sl.on(notifications.connected, ({data:socketStream}) => {

        const stream = socketStream.stream;
        socketStream.pipe(socketStream);
        stream.pipe(stream);

        socketStream.on(notifications.read,(event)=> {
          if (event.text === 'quit') {
            finalize(socketStream);
            done.resolve();
          }
        });

      });
      await done;
    }

    finally {
      finalize(sl);
    }
  });

});
