// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { is } from '../system/guards';

export function deconstruct(identifier: string | Array<string>): Array<string> {
  if (is.array(identifier)) {
    return identifier.flatMap(deconstruct);
  }
  return `${identifier}`
    .replace(/([a-z]+)([A-Z])/g, '$1 $2')
    .replace(/(\d+)([a-z|A-Z]+)/g, '$1 $2')
    .replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
    .split(/[\W|_]+/)
    .map((each) => each.toLowerCase());
}

export function smash(identifier: string | Array<string>): string {
  return deconstruct(identifier).join('');
}

export function pascalCase(identifier: string | Array<string>): string {
  return deconstruct(identifier)
    .map((each) => each.charAt(0).toUpperCase() + each.slice(1))
    .join('');
}

export function camelCase(identifier: string | Array<string>): string {
  return deconstruct(identifier)
    .map((each, index) => (index === 0 ? each : each.charAt(0).toUpperCase() + each.slice(1)))
    .join('');
}

export function dashCase(identifier: string | Array<string>): string {
  return deconstruct(identifier).join('-');
}