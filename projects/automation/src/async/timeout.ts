// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.
// import { addMisbehavingPromise } from '../system/checks';
import { sleep } from './sleep';

/** wait on any of the promises to resolve, or the timeout to expire */

export function timeout(msecs: number, ...promises: Array<Promise<any>>): Promise<any> {
  // we are tracking the promise, because .any() will resolve multiple times, and we want to ignore those in the dev mode checks.
  // return addMisbehavingPromise(Promise.any([sleep(msecs), ...promises]));
  return Promise.any([sleep(msecs), ...promises]);
}
