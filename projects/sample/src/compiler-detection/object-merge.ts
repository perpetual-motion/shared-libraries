// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.


function isMergeble(item:any): boolean {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
};

export function mergeObjects<T extends Record<string,any>>(input: T, ...sources: Array<Record<string,any>>): T {
  if (!sources.length) {
    return input;
  }
  const target = input as any;
  for (const source of sources) {

    if (isMergeble(target) && isMergeble(source)) {
      for (const [key,value] of Object.entries(source)) {
        // if there isn't a target value, just assign a copy of the source value
        if (target[key] === undefined) {
          target[key] = JSON.parse(JSON.stringify(value));
          continue;
        }

        // if the source value is null, we're going to delete the target value
        if (value === null) {
          delete target[key];
          continue;
        }

        // if the source value is undefined, we're going to leave the target value as is
        if (value === undefined) {
          continue;
        }

        // if the source value is an array, the target is going to be an array.
        if (Array.isArray(value)) {
          // arrays are appended
          if (target[key] === undefined) {
            // no target value, just assign
            target[key] = [...value];
          } else if (Array.isArray(target[key])) {
            // target value is an array, append
            target.key.push(...value);
          } else if (typeof target[key] === 'string') {
            // strings are converted to arrays
            target[key] = [value,...value];
          }
          continue;
        }

        // if the source value is an object, we're going to merge that with the target
        if (isMergeble(value)) {
          mergeObjects(target[key], value);
          continue;
        }

        // otherwise,
        target[key] = value;

      };
    }
  }

  return target;
};

