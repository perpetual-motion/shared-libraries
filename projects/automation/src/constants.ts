// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { first } from './system/array';
import { initDevModeChecks } from './system/checks';

export const isWindows = process.platform === 'win32';
export const baseFolder = process.cwd();
export const nodeCmd = process.execPath;
export const nodeArgs = process.versions.electron ? ['--ms-enable-electron-run-as-node','--enable-source-maps'] : ['--enable-source-maps'];

export const debugType = 'device-debugger';

export const DEVMODE = true;
// put this in the global scope that code can find it without having to import it.
(global as any).DEVMODE = DEVMODE;


// These sections of code are placed here because it is guaranteed to be loaded in pretty much all scenarios.

// POLYFILLS
// ---------
declare global {
  interface Array<T> {
    first(predicate?:(element:T)=>any|undefined): T | undefined;
  }
  interface Set<T> {
    first(predicate?:(element:T)=>any|undefined): T | undefined;
  }
}
// eslint-disable-next-line no-extend-native
Object.defineProperties(Array.prototype, {
  first: { value: function (predicate:(element:any)=>any|undefined) { return first((this as Array<any>), predicate); } }
});

// eslint-disable-next-line no-extend-native
Object.defineProperties(Set.prototype, {
  first: { value: function (predicate:(element:any)=>any|undefined) { return first((this as Set<any>), predicate); } }
});

// DEV MODE CHECKS
// ---------------
// these are placed here because it is guaranteed to be loaded in pretty much all scenarios.
if (DEVMODE){
  initDevModeChecks();
}

