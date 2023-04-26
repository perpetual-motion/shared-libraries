// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { MessagePort } from 'worker_threads';
import { getReservations } from '../automation/ports';
import { out } from '../eventing/channels';
import { collectGarbage } from './garbage-collector';

function showActiveHandles() {
  const open = (process as any)._getActiveHandles().filter(
    (each:any) =>{
      return !each.destroyed && // discard handles that claim they are destroyed.
      !(each.fd === 0) &&  // ignore stdin/stdout/stderr
      !(each.fd === 1) &&  // ignore stdin/stdout/stderr
      !(each.fd === 2) &&  // ignore stdin/stdout/stderr
      !(each instanceof MessagePort) && // ignore worker thread message ports
      (each.listening); // keep servers that are still listening.
    }
  );

  if (open.length) {
    out('################');
    out('Active Handles: ');
    out('################');
    out(open);
    out([...getReservations()].join('\n'));
  }
}

let misbehavingPromises:Set<Promise<any>>;

export function addMisbehavingPromise(promise:Promise<any>) {
  misbehavingPromises?.add(promise);
  return promise;
}
let MAX = 20;

export function initDevModeChecks() {
  return;
  misbehavingPromises = new Set<Promise<any>>();

  try {
    require('mocha').afterAll?.(()=> {
      collectGarbage();
      showActiveHandles();
    });
  } catch {
  // ignore
  }

  process.on('unhandledRejection', (reason:any, p) => {
    if (reason?.stack?.includes('Git error')){
      return;
    }
    out(`Unhandled Rejection at: Promise ${p} - reason:, ${(reason as any)?.stack ?? reason}`);
  });

  process.on('multipleResolves', (type, promise, reason) => {
    if (misbehavingPromises.has(promise)) {
      misbehavingPromises.delete(promise);
      return;
    }
    if (reason && (reason as any).stack) {
      console.error((reason as any).stack);
      return;
    }
    if (!MAX--) {
      process.exit(1);
      throw new Error('MAX MULTIPLE RESOLVED REACHED');

    }
    console.error({text: 'Multiple Resolves', type, promise, reason});
  });

  process.on('exit', showActiveHandles);
}
