// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { is } from './guards';
import { Primitive } from './types';

export function primitives(args: Array<unknown> | undefined): Array<Primitive> {
  return args && args.length ? args.filter(is.primitive) as Array<Primitive> : [];
}