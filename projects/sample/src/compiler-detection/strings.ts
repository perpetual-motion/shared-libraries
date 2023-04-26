/* eslint-disable header/header */

import { resolve } from 'path';
import { OneOrMore } from './interfaces';

export function strings(input:OneOrMore<string>|undefined|Set<string>) : Array<string> {
  if (!input) {
    return [];
  }
  if (input instanceof Set) {
    return [...input];
  }
  if (typeof input === 'string') {
    return [input];
  }
  return input;
}


export function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

export function nativePath(path:string){
  return resolve(path);
}