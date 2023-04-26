// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { Process } from '../automation/process';
import { SocketStream } from '../automation/sockets';

import { subscribe } from '../eventing/dispatcher';
import { finalize } from './finalize';
import { Instance } from './types';

function red(text: string) {
  return text;
}

function green(text: string) {
  return text;
}

let unsubs: (()=> void)|undefined;
export let writer: SocketStream;
export function monitorChildProcessOutput() : ()=> void {
  writer = new SocketStream('localhost',7777,{retries: -1, delay: 500, on: {
    'this connected': ()=>{
      unsubs = subscribe({
        'console/wrote': ({text})=>writer.writeln(red(text)),
        'console/read': ({text})=>writer.writeln(text),
        'process/started': ({source})=>{
          if (source) {
            const s = source as Instance<Process>;
            void writer.writeln(green(`process started: '${s.pid}': '${s.name}' ${s.args.map(each => `'${each}'`).join(' ')} ${s.pid}`));
          }
        },
        'process/exited': async ({data:rc, source})=>{
          if (source) {
            const s = source as Instance<Process>;
            void writer.writeln(red(`process exited: '${s.pid}'/rc(${rc}) : '${s.name}' ${s.args.map(each => `'${each}'`).join(' ')} `));
          }
        }
      });
    },
    'this disconnected': ()=>{
      unsubs?.();
      unsubs = undefined;
      finalize(writer);
      if (writer) {
        // if this was a disconnect, we need to re-establish the connection
        monitorChildProcessOutput();
      }
    }
  }});

  return ()=>{
    const w= writer;
    writer = undefined!;
    finalize(w);
  };
}