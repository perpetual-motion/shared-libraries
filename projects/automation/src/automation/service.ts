// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { fail, ok } from 'assert';
import { Async } from '../async/constructor';
import { lazy } from '../async/lazy';
import { debug } from '../eventing/channels';
import { Emitter } from '../eventing/emitter';
import { notifications, queries } from '../eventing/names';
import { firstOrFail } from '../system/array';
import { finalize } from '../system/finalize';
import { Instance } from '../system/types';
import { formatHostName, Port, release } from './ports';
import { Process } from './process';
import { ProcessFunction, Program } from './program';
import { SocketListener, SocketStream } from './sockets';

export interface CapturedPort {
  readonly target: Port;
  readonly listener: Port;
}

export interface Semantics {
  readonly args: Array<string>;
  consolePort?: Port;
  errorPort?: Port;
  capturedPorts?: Map<string,CapturedPort>;
}

function pipeProcessStreams(process: Instance<Process>, console?: SocketListener, error?: SocketListener) {
  const streams = new Set<SocketStream>();

  if (console) {
    console.on(notifications.connected, ({data:socketStream}) => {
      streams.add(socketStream);
      void socketStream.stream.writeln(...process.console.all());
      socketStream.pipe(process.console);
      socketStream.on(notifications.disconnected, ()=> finalize(socketStream));
    });
  }
  if (error) {
    error.on(notifications.connected, ({data:socketStream}) => {
      streams.add(socketStream);
      socketStream.pipe(process.error);
      socketStream.on(notifications.disconnected, ()=> finalize(socketStream));
    });
  }
  // when the process disconects, shut down the listeners.
  process.on(notifications.exited,()=>{
    debug(`cleaning up streams in ${process.constructor.name}`);
    finalize(console);
    finalize(error);
    finalize(...streams);
  });
}


export class Service extends Async(class Service extends Emitter {
  static choices = lazy<Set<string>>(Set<string>);
  static readonly serviceName:string = '<name>';
  static readonly serviceTitle:string = '<service>';

  #process: Instance<Process>|undefined;
  #program!: ProcessFunction;
  #semantics!: Semantics;

  /** static 'class' accessor */
  get $class() { return this.constructor as typeof Service;};

  /** Event: Signaled when we're selecting a binary */
  selectBinary = this.newEvent<string,Set<string>,string>(queries.selectBinary,{now: true, cancel:()=> fail('cancelled'), default: ()=> firstOrFail(this.$class.choices, `no binary for ${this.$class.serviceTitle} found.`)});

  readyToCapture = this.newNotification('ready-to-capture-ports');

  constructor() {
    super();
  }

  get semantics() : Semantics{
    return this.#semantics;
  }

  async init() {
    // find the binary to use
    const choices = await this.$class.choices;
    const binary=  await this.selectBinary(this.$class.serviceName,choices);

    this.#program = await new Program(binary);
    this.subscribe();
  }

  get console() {
    return formatHostName(this.semantics.consolePort) || '';
  }

  get error() {
    return formatHostName(this.semantics.errorPort) || '';
  }

  readonly ports = new Array<number>();

  async prepare(semantics: Semantics = {args:[]}) : Promise<Semantics> {
    this.#semantics = semantics;
    return this.#semantics;
  }

  async start() {
    ok(!this.#process, 'The process has already been started.');
    ok(this.#semantics, 'The program has not been prepared.');

    // create the process, and ensure that this instance is subscribed to the process events.
    this.#process =  await this.#program(...this.#semantics.args, {on: this});
  }

  async stop() {
    finalize(this.#process);
    this.#process = undefined;

    ok(this.#semantics, 'The program has not been prepared.');
    if (this.#semantics.capturedPorts) {
      for (const [ purpose, port ] of this.#semantics.capturedPorts) {
        release(port.target);
        release(port.listener);
      }
    }
  }

  async 'this ready-to-capture-ports'() {
    ok(this.#process, 'The process has not been started.');
    const consoleListener = this.#semantics.consolePort ? new SocketListener(this.#semantics.consolePort) : undefined;
    const errorListener = this.#semantics.errorPort ? new SocketListener(this.#semantics.errorPort) : undefined;
    pipeProcessStreams(this.#process, consoleListener, errorListener);


    if (consoleListener) {
      consoleListener.on(notifications.connected, ({data:socketStream}) => {
        socketStream.pipe(this.#process!.console);
        socketStream.on(notifications.disconnected, ()=> finalize(socketStream));
      });
    }

    // todo monday morning we have to wait for the ports to be ready before we capture them.
    if (this.#semantics.capturedPorts) {
      for (const [purpose, port ] of this.#semantics.capturedPorts) {
        const target = new SocketStream(port.target);
        const listener = new SocketListener(port.listener);
        target.on(notifications.disconnected,()=> finalize(target,listener));

        listener.on(notifications.connected, ({data:socketStream}) => {
          socketStream.pipe(this.#process!.console);
          socketStream.on(notifications.disconnected, ()=> finalize(socketStream));
          target.on(notifications.disconnected,()=> finalize(socketStream));
        });
      }
    }

  }

  async createListeners() {

  }

  get process() {
    return this.#process;
  }

}) {}