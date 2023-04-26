// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { inspect } from 'util';
import { DEVMODE } from '../constants';
import { is } from '../system/guards';
import { notify } from './dispatcher';
import { channels } from './names';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function out(...messages: Array<any>) {
  messages.forEach((each)=> console.log(each));
}

export function debug(...messages: Array<any>) {
  messages.forEach((message)=>  notify(channels.debug,is.primitive(message) ? message.toString() : inspect(message,false, 2,true)));
}

export function clear() {
  notify('clear');
}

export function verbose(...messages: Array<any>) {
  messages.forEach((message)=> notify(channels.verbose, is.primitive(message) ? message.toString() : inspect(message,false, 2,true)));
}

export function info(...messages: Array<any>) {
  messages.forEach((message)=> notify(channels.info, is.primitive(message) ? message.toString() : inspect(message,false, 2,true)));
}

export function warning(...messages: Array<any>) {
  messages.forEach((message)=> notify(channels.warning, is.primitive(message) ? message.toString() : inspect(message,false, 2,true)));
}

export function internal(...messages: Array<any>) {
  if (DEVMODE) {
  //  messages.forEach((message)=> notify(channels.internal, is.primitive(message) ? message.toString() : inspect(message,false, 2,true)));
  }
}

export function error(...messages: Array<any>) {
  messages.forEach(message=> notify(channels.error,is.primitive(message) ? message.toString() : inspect(message,false, 2,true)));
}


class Stopwatch {
  private start: number;
  private last: number;

  constructor() {
    this.last = this.start = Date.now();
  }

  lap(text: string) {
    const elapsed = Date.now() - this.last;
    debug(`Elapsed: ${text} ${elapsed}ms`);
    this.last = Date.now();
  }

  total(text: string) {
    const elapsed = Date.now() - this.start;
    debug(`Total: ${text} ${elapsed}ms`);
  }
}

export function start() {
  const stopwatch = new Stopwatch();
  const result = (text:string)=> stopwatch.lap(text);
  result.total = (text:string)=> stopwatch.total(text);
  return result;
}