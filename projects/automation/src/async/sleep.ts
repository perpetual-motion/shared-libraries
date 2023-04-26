// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.


/** pause for a number of milliseconds */
export function sleep(msecs: number): Promise<number> {
  return new Promise<number>((resolve) => setTimeout(()=>resolve(msecs),msecs));
}

