// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { Server as NetServer, Socket, SocketConnectOpts, SocketConstructorOpts } from 'net';
import { ManualPromise } from '../async/manual-promise';
import { Emitter } from '../eventing/emitter';
import { ArbitraryObject, Callback, EventData, Unsubscribe } from '../eventing/interfaces';
import { events, notifications } from '../eventing/names';
import { finalize } from '../system/finalize';
import { is } from '../system/guards';
import { Port } from './ports';
import { ReadableLineStream, ReadWriteLineStream } from './streams';

interface SocketOptions extends SocketConstructorOpts{
  retries?: number;
  delay?: number;
  reconnect?: boolean;
}

export class SocketPlus extends Socket {
  #options: SocketOptions & { args?: Array<any> };
  constructor(options?:SocketOptions) {
    super(options);
    this.#options = options || {};

    if (this.#options.retries) {
      const retry = (err:any)=> {
        if (this.#options.retries && err.code === 'ECONNREFUSED') {
          if (this.#options.retries) {
            this.once('error',retry);
            this.#options.retries--;
            setTimeout(()=> (this.connect as any)(...this.#options.args!), this.#options.delay || 500);
          }
        }
      };

      // add the retry handler
      this.once('error',retry);

      // remove the retry handler when we get a connection
      this.on('connect',()=> {
        this.removeListener('error',retry);
      });
    }
  }

  override connect(options: SocketConnectOpts, connectionListener?: () => void): this;
  override connect(port: number, host: string, connectionListener?: () => void): this;
  override connect(port: number, connectionListener?: () => void): this;
  override connect(path: string, connectionListener?: () => void): this;
  override connect(...args:Array<any>): this {
    this.#options.args = args.filter(each => typeof each !== 'function');
    return (super.connect as any)(...args);
  }

  override end(callback?: (() => void) | undefined): this;
  override end(buffer: string | Uint8Array, callback?: (() => void) | undefined): this;
  override end(str: string | Uint8Array, encoding?: BufferEncoding | undefined, callback?: (() => void) | undefined): this;
  override end(str?: unknown, encoding?: unknown, callback?: unknown): this {
    if (this.#options) {
      this.#options.reconnect = false;
      this.#options.retries = 0;
    }

    return super.end(str as any, encoding as any, callback as any);
  }
}

export interface SocketStream {
  on(event:'connected', handler: () => void): Unsubscribe;
  on(event:'disconnected', handler: () => void): Unsubscribe;
  on(event:'reading', handler: Callback<string>): Unsubscribe;
  on(event:'writing',handler: Callback<string>): Unsubscribe;
  on(event:string, handler: Callback<any>):Unsubscribe;
}

interface SocketStreamOptions {
  retries?: number;
  delay?: number;
  on: ArbitraryObject;
}

export class SocketStream extends Emitter {
  #socket!: Socket;

  protected disconnected = this.newNotification(notifications.disconnected, { once: true });
  protected connected = this.newNotification(notifications.connected,{ once: true });

  ready = new ManualPromise<boolean>();
  readonly stream: ReadWriteLineStream;

  pipe(stream: ReadableLineStream | { stream: ReadableLineStream }) : void {
    if (stream instanceof ReadableLineStream) {
      if (is.writable(stream)) {
        this.stream.pipe(stream);
      }

      stream.pipe(this.stream);
      return;
    }
    return this.pipe(stream.stream);
  }

  unpipe(stream?: ReadWriteLineStream) {
    if (!stream) {
      for (const each of this.stream.pipes) {
        this.stream.unpipe(each);
      }
    } else {
      this.stream.unpipe(stream);
    }
  }

  protected get socket() {
    return this.#socket;
  }

  private set socket(socket: Socket) {
    this.#socket = socket;
    if (!socket) {
      return ;
    }
    // if it hasn't connected yet, when it does, we'll fire the connected event.
    if ((this.#socket as any).pending) {
      this.#socket.once('connect', ()=>{
        this.connected();
        socket.once('close',()=>{
          this.disconnected();
          finalize(socket);
        });
        this.ready.resolve(true);
      });
    } else {
      // already connected, so we should fire the event now.
      this.connected();
      socket.on('close',()=>{
        this.disconnected();
        finalize(socket);
      });
      this.ready.resolve(true);
    }
  }

  constructor(port: Port, options?: SocketStreamOptions)
  constructor(host: string, port: number,options?: SocketStreamOptions)
  constructor(socket: Socket,options?: SocketStreamOptions)
  constructor(portHostOrSocket: string | Socket | Port, portOrOptions?: number|SocketStreamOptions,options?: SocketStreamOptions) {
    super();
    if (is.socket(portHostOrSocket)) {
      // one or two params
      // we've been given the socket already connected
      options = portOrOptions as SocketStreamOptions || {};
      if (options.on) {
        this.subscribe(options.on);
      }
      this.socket = portHostOrSocket;
      this.socket.on('end',()=> finalize(this));

    } else {
      let host: string;
      let port: number;
      if (is.port(portHostOrSocket)) {
        host = portHostOrSocket.host;
        port = portHostOrSocket.port;
        options = portOrOptions as SocketStreamOptions || {};
      } else {
        host = portHostOrSocket;
        port = portOrOptions as number;
      }

      if (options?.on) {
        this.subscribe(options.on);
      }
      this.socket = new SocketPlus({retries: options?.retries, delay:  options?.delay});
      this.socket.on('connect',()=> this.socket.on('end',()=> finalize(this)));

      this.socket.connect(port, host);
    }

    this.stream = new ReadWriteLineStream(this.socket);
    this.stream.setReadEvent(this.newEvent<string,string>(events.reading));
    this.stream.setWriteEvent(this.newEvent<string,string>(events.writing));

  }

  close() {
    finalize(this.stream);
    finalize(this.socket);
    this.disconnected();
    this.socket = undefined!;
  }

  get all() {
    return this.stream.all();
  }

  async writeln(...line: Array<string>) {
    return this.stream.writeln(...line);
  }
}

export class Server extends NetServer {
  async finalize() {
    const promise = new ManualPromise();
    this.close(()=>promise.resolve());
    return promise;
  }
}

export interface SocketListener {
  on(event:'connected', handler: Callback<SocketStream>):Unsubscribe;
  on(event:string, handler: Callback):Unsubscribe;
}

export interface SocketListenerOptions {
  on: ArbitraryObject;
}

export class SocketListener extends Emitter {
  protected connected = this.newNotification<SocketStream>(notifications.connected, {now: true});

  ready = new ManualPromise<boolean>();
  private server: Server;
  public readonly port;
  public readonly host;

  constructor(port: number|Port, options?: SocketListenerOptions) {
    super();
    if (options?.on) {
      this.subscribe(options.on);
    }
    if (is.port(port)) {
      this.host = port.host;
      this.port = port.port;
    } else {
      this.host = 'localhost';
      this.port = port;
    }
    this.server = new Server();
    this.server.listen(this.port, this.host, () => {
      this.ready.resolve(true);
    });

    this.server.on('connection', (socket) => {
      const stream = new SocketStream(socket);
      this.connected(stream);
    });
  }

  close() {
    finalize(this.server);
    this.server = undefined!;
  }
}

export interface SocketMessageListener {
  on(event:'message', handler: Callback<string>):Unsubscribe;
  on(event:string, handler: Callback|((event:EventData)=>Record<string,Callback>)):Unsubscribe;
  once(event:'message', handler: Callback<string>):Unsubscribe;
  once(event:string, handler: Callback):Unsubscribe;
}

/**
 * A socket message is a string payload that is accepted over a socket.
 *
 * This just listens for the socket to be connected, reads the data, and when the socket is closed it then fires the message event.
 */
export class SocketMessageListener extends Emitter {
  listener: SocketListener;
  protected message = this.newNotification<string>(notifications.message);

  constructor(public readonly port: number|Port) {
    super();
    this.listener = new SocketListener(port);
    this.listener.on('connected', async ({data:stream}) => {
      // when it gets connected, the stream will capture the data automatically.
      // all we have to do is wait for the stream to close, and then we can signal the message.
      stream.on(notifications.disconnected, async ()=> {
        return this.message(stream.all.join('\n'));
      });
    });
  }

  get ready() {
    return this.listener.ready;
  }

  close() {
    finalize(this.listener);
  }
}

