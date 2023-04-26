// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { ManualPromise } from '../async/manual-promise';
import { formatHostName, Port } from '../automation/ports';
import { SocketListener, SocketStream } from '../automation/sockets';

import { EventData } from '../eventing/interfaces';

const inputStreams = new Set<SocketStream>();
const   outputStreams = new Set<SocketStream>();
const   unsubConsoles = new Set<()=>void>();

function unpipe(to?: Port) {
  if (to) {
    for (const input of inputStreams){
      input.unpipe();
      for (const output of outputStreams){
        output.unpipe();
      }
    }
  } else {
    for (const unsub of unsubConsoles) {
      unsub();
    }
  }
}

// connect the input streams to the output streams
function pipe(out:(txt:any)=>void) {
  if (inputStreams.size === 0) {
    // out('No input streams to monitor');
    unpipe();
  }

  if (outputStreams.size){
    // we have output streams, so we're piping, not just logging to the console.
    for (const input of inputStreams){
      for (const output of outputStreams){
        input.pipe(output);
      }
    }

    // if we had a console subscription, remove them.
    for (const unsub of unsubConsoles) {
      unsub();
    }
    unsubConsoles.clear();

  } else {
    for (const unsub of unsubConsoles) {
      unsub();
    }
    // just log the streams to the console when we don't have any output streams.
    for (const input of inputStreams){
      unsubConsoles.add(input.on('reading',({data})=> out(data)));
      unsubConsoles.add(input.on('writing',({data})=> out(data)));
    }
  }
}

export async function monitor(out:(txt:any)=>void, address:Port, to?:Port): Promise<void> {
  const forever = new ManualPromise();

  if (to) {
    out(`listening on output port ${formatHostName(to)}`);
    const target = new SocketListener(to,{
      on: {
        'this connected': ({data:stream}:EventData<SocketStream>)=> {
          out('Output Stream connected');
          // send the data to the other port
          outputStreams.add(stream);
          pipe(out);
          stream.on('disconnected',()=> {
            out('Output Stream disconnected');
            outputStreams.delete(stream);
            unpipe();
            pipe(out);
          });
        }
      }
    });
  }

  out(`listening on input port ${formatHostName(address!)}`);
  const listener = new SocketListener(address, { on: {
    'this connected':({data:socketStream}:EventData<SocketStream>)=> {
      out('Input Stream connected');
      inputStreams.add(socketStream);
      pipe(out);
      socketStream.on('disconnected',()=> {
        out('Input Stream disconnected');
        inputStreams.delete(socketStream);
        unpipe();
        pipe(out);
      });
    },

  }});

  return forever;
}