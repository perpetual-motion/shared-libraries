// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { debug } from '../eventing/channels';


export function callStack(): string {
  try {
    debug('getting call stack');
    throw new Error();
  } catch (error:any) {
    return error.stack?.split('\n').slice(2).join('\n');
  }
  return '';
}