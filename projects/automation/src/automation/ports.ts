// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { fail, ok } from 'assert';
import { createServer } from 'net';
import { NetworkInterfaceInfo, networkInterfaces } from 'os';
import { ManualPromise } from '../async/manual-promise';
import { first } from '../system/array';
import { finalize } from '../system/finalize';
import { is } from '../system/guards';
import { linq } from '../system/linq';

const BASE = 0xABBA;

interface Host {
  iface: string;
  address: string;
  netmask: string;
  mac: string;
  internal: boolean;
  basePort: number;
}

export interface Port {
  purpose: string;
  port: number;
  host: string;
}

export function formatHostName(port: undefined) :undefined
export function formatHostName(port: Port) :string
export function formatHostName(port: Port|undefined) :string|undefined // this resolves the problem, but I don't like that I had to do this.
export function formatHostName(port: number, host: string | Host): string
export function formatHostName(port: number|Port|undefined, host?: string | Host): string|undefined {
  if (!port) {
    return undefined;
  }
  if (is.port(port)) {
    return formatHostName(port.port, port.host);
  }
  return (typeof host === 'string') ? `${host}:${port}`.toLowerCase() : `${host!.address}:${port}`.toLowerCase();
}

function getHosts() {
  let interfaces = {};
  try {
    interfaces = networkInterfaces();
  }
  catch (e:any) {
    if (e?.syscall === 'uv_interface_addresses') {
      // swallow error because we're just going to use defaults
      throw e;
    }
  }

  // set default available hosts first
  const result =  new Map<string,Host>([['127.0.0.1',{
    iface: 'loopback',
    address: '127.0.0.1',
    netmask: '255.0.0.0',
    mac: '00:00:00:00:00:00',
    internal: true,
    basePort: BASE
  }],['0.0.0.0',{
    iface: 'any',
    address: '0.0.0.0',
    netmask: '0.0.0.0',
    mac: '00:00:00:00:00:00',
    internal: true,
    basePort: BASE
  }]]);

  for (const [iface, addresses] of linq.entries<string, Array<NetworkInterfaceInfo>,Record<string,Array<NetworkInterfaceInfo>>>(interfaces)) {
    for (const address of addresses) {
      result.set(address.address,{ ... address,iface , basePort: BASE, });
    }
  }
  return result;
}

const knownHosts = getHosts();

export function getHost(name?: string) : Host{
  if (name === 'localhost') {
    return getHost('127.0.0.1');
  }
  return (name ? knownHosts.get(name) : first(knownHosts.values())) || fail(`No host available (name: ${name})`);
}

function testPort(port:number, host:string): Promise<boolean> {
  const result = new ManualPromise<boolean>();
  const server = createServer(()=> {});

  server.once('error',(error)=> {
    finalize(server);
    result.resolve(false);
  });

  server.once('listening',()=>{
    finalize(server);
    result.resolve(true);
  });

  server.listen(port, host);

  return result;
}


const reservations = new Map<string,Port>();

export function *getReservations() {
  for (const [key, reservation] of reservations.entries()) {
    yield `${key} => ${reservation.purpose}`;
  }
}

export async function reserveCapturePort(purpose: string) {
  return { target: await reserve(`${purpose} (target)`), listener: await reserve(`${purpose} (listener)`) };
}

export async function reserve(purpose:string, options?: { port?: number, hostAddress?: string}) : Promise<Port> {
  if (options?.port === undefined) {
    return findFreePort(purpose, options);
  }

  const port = options.port;
  ok(port > 1024 && port < 65536, `Port ${port} is not a valid port`);

  if (options?.hostAddress === 'all') {
    // they are requesting that this port be reserved on all interfaces
    // and not to test if it is available
    const allKey = formatHostName(port, 'all');
    ok(!reservations.has(allKey), `Port ${allKey} is already reserved on all interfaces`);
    const result = { purpose, port, host: 'all' };
    reservations.set(allKey, { purpose, port, host: 'all' });
    for (const each of knownHosts.values()) {
      const key = formatHostName(port, each);
      ok(!reservations.has(key), `Port ${key} is already reserved on ${each.iface}`);
      reservations.set(key, { purpose, port, host: each.address });
    }
    return result;
  }

  const host = getHost(options?.hostAddress);

  const key = formatHostName(options.port, host);
  ok(!reservations.has(key), `Port ${key} is already reserved`);

  const reservation = { purpose: 'testing', port, host: host.address };
  // mark port reserved first
  reservations.set(key, reservation);

  if (!await testPort(port, host.address)) {
    reservations.delete(key);
    throw new Error(`Port ${key} is already in use by something else.`);
  };

  // port seems available, set the purpose and leave
  reservation.purpose = purpose;

  return reservation;
}

export function release(reservation: Port|undefined) {
  if (!reservation) {
    return undefined;
  }
  reservations.delete(formatHostName(reservation.port,reservation.host));
  if (reservation.host === 'all') {
    for (const each of knownHosts.values()) {
      reservations.delete(formatHostName(reservation.port,each));
    }
  }
  return undefined;
}

export async function findFreePort(purpose: string, options?: { hostAddress?: string}) : Promise<Port> {
  const host = getHost(options?.hostAddress);

  let port = 0;
  do {
    port = (host.basePort+=10);
    const key = formatHostName(port, host);
    if (reservations.has(key)){
      continue;
    }
    // mark port reserved first
    const reservation = { purpose: 'testing', port, host: host.address };
    reservations.set(key, reservation);

    // is the port available?
    if (!await testPort(port, host.address)) {
      reservations.delete(key);
      continue;
    };

    // port seems available, set the purpose and leave
    reservation.purpose = purpose;

    return reservation;
  } while (port < 65536);

  throw new Error('No ports available');
}
