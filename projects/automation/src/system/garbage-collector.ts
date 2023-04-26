// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { setFlagsFromString } from 'v8';
import { runInNewContext } from 'vm';

setFlagsFromString('--expose_gc');
const gc = runInNewContext('gc'); // nocommit

export function collectGarbage() {
  gc(true);
}