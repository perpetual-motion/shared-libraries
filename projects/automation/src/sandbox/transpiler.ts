// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import path from 'path';
import Piscina from 'piscina';
import * as ts from 'ts-morph';
import { ScriptError } from './interfaces';

let workers:Piscina;
if (!Piscina.isWorkerThread){
  workers = new Piscina({
    filename: path.resolve(__dirname, 'worker.js'),
    idleTimeout: 5000,
    minThreads: 2,
    maxThreads: 8,
  });
}

/**
 * This is the wrapper to the transpiler worker.
 * The actual worker is in a worker thread (provided by ./worker.ts)
 *
 * @param sourceCode
 * @param filename
 * @param ignoreCodes
 * @param options
 * @returns
 */
export async function transpile(sourceCode: string,filename: string, ignoreCodes: Array<number> = [], options?: ts.ts.CompilerOptions & { rawFunction?: boolean  }):Promise<string| Array<ScriptError>> {
  return await workers.run({sourceCode, filename, ignoreCodes, options});
}