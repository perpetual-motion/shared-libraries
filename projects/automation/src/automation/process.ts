// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.
/* eslint-disable @typescript-eslint/naming-convention */

import { ChildProcess, spawn } from 'child_process';
import { basename, resolve } from 'path';
import { Async } from '../async/constructor';
import { ManualPromise } from '../async/manual-promise';
import { debug } from '../eventing/channels';

import { Emitter } from '../eventing/emitter';
import { ArbitraryObject, Callback, Unsubscribe } from '../eventing/interfaces';
import { events, notifications } from '../eventing/names';
import { finalize } from '../system/finalize';
import { Primitive } from '../system/types';
import { ReadableLineStream, ReadWriteLineStream } from './streams';

export interface _Process extends Emitter {
  readonly console: ReadWriteLineStream;
  readonly error: ReadableLineStream;

  readonly active: boolean;
  readonly exitCode: Promise<number>;
  write(data: string): Promise<void>;
  writeln(data: string): Promise<void>;
  all(): Array<string>;
  clear(): void;
  stop(): void;
}

interface ProcessEvents {
  on(event:'started', handler: Callback<void>):Unsubscribe;
  on(event:'exited', handler: Callback<void>):Unsubscribe;
  on(event:string, handler: Callback<any>):Unsubscribe;
  once(event:'started', handler: Callback<void>):Unsubscribe;
  once(event:'exited', handler: Callback<void>):Unsubscribe;
  once(event:string, handler: Callback<any>):Unsubscribe;
}

class ProcessEvents extends Emitter {

}

export class Process extends Async(class Process extends ProcessEvents {
  #process: ChildProcess;

  readonly console: ReadWriteLineStream;
  readonly error: ReadableLineStream;

  time: string = new Date().toString().replace(/\s|GMT.*/gi,'-').replace('--','');

  get active() {
    return this.exitCode.isCompleted === false;
  }

  get name() {
    return basename(this.executable);
  }

  get pid() {
    return this.#process.pid;
  }

  /** Event signals when the process is being launched */
  started = this.newNotification(notifications.started, {now: true, once: true});

  /** Event signals when the process has stopped */
  exited = this.newNotification<number>(notifications.exited, {now: true, once: true});

  exitCode = new ManualPromise<number>();
  init: Promise<void> | undefined;

  constructor(readonly executable: string, readonly args: Array<Primitive>, readonly cwd = process.cwd(), readonly env = process.env, stdInOpen = true, ...subscribers: Array<ArbitraryObject>) {
    super();
    // add any subscribers to the process events before anything else happens
    this.subscribe(...subscribers);

    let spawned = false;
    executable = resolve(executable); // ensure that slashes are correct -- if they aren't, cmd.exe itself fails when slashes are wrong. (other apps don't necessarily fail, but cmd.exe does)

    const process = this.#process = spawn(executable, args.map((each) => each.toString()), { cwd, env, stdio: [stdInOpen ? 'pipe' : null, 'pipe', 'pipe'], shell: false}).
      on('error',(err:Error)=>{
        this.exitCode.reject(err);
      }).
      on('spawn',()=>{
        spawned = true;
        void this.started();
      }).
      on('close', (code: number, signal: NodeJS.Signals) => {
        this.exitCode.resolve(code);

        if (spawned) {
          // ensure the streams are completely closed before we emit the exited event
          finalize(this.console);
          finalize(this.error);
        }

        debug(`Process '${this.name}' exiting with code ${code}.`);

        this.exited(code|| (signal as any));
        debug(`Called Exited for '${this.name}'`);
      });

    this.console = new ReadWriteLineStream(process.stdout, process.stdin);
    this.error = new ReadableLineStream(process.stderr);

    // enable console stream events/notifications
    this.console.setReadNotifier(this.newNotification<string>(notifications.read, {descriptors:{console:this.name}}));
    this.console.setReadEvent(this.newEvent<string,string>(events.reading, {descriptors:{console:this.name}, now: true}));
    this.console.setWriteNotifier(this.newEvent<string,string>(notifications.wrote, {descriptors:{console:this.name},now: true}));
    this.console.setWriteEvent(this.newEvent<string,string>(events.writing, {descriptors:{console:this.name},now: true}));

    // enable error streams events/notifications
    this.error.setReadNotifier(this.newNotification<string>(notifications.read,{descriptors:{error:this.name}}));
    this.error.setReadEvent(this.newEvent<string,string>(events.reading, {descriptors:{error:this.name},now: true}));
  }

  write(...lines: Array<string>) {
    return this.console.write(...lines);
  }

  writeln(...lines: Array<string>) {
    return this.console.writeln(...lines);
  }

  all() {
    return [...this.console.all(),...this.error.all()];
  }

  clear() {
    this.console.clear();
    this.error.clear();
  }

  close() {
    debug(`closing process ${this.name}`);
    this.#process.kill('SIGTERM');
  }
}){};
