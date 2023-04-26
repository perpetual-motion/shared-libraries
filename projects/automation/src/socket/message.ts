// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { Socket } from 'net';
import { finalize } from '../system/finalize';

export function sendMessage(port: number, message: string, options? : { timeout?: number }) {
  const socket = new Socket();
  socket.setTimeout(typeof options?.timeout === 'number' ? options.timeout : 1000);
  socket.connect({ port }, () => {
    socket.write(message);
    finalize(socket);
  });
}