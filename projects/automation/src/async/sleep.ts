// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.


export { setImmediate as now, setTimeout as after } from 'timers/promises';
import { setTimeout as after } from 'timers/promises';

/** pause for a number of milliseconds */
export const sleep = after as (msec:number)=>Promise<void>;
