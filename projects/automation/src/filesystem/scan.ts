// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { open } from 'fs/promises';
import { finalize } from '../system/finalize';
import { path } from './path';

const BUFSIZE = 32 * 1024;

/** Returns strings found in a binary file */
export async function* getStringsFromFile(fullPath:any|string|undefined|Promise<string|undefined>, minLength = 4, maxLength = 1024) {
  // ensure we have a file
  fullPath = await path.isFile(fullPath);
  if (!fullPath){
    return;
  }
  const f = await open(fullPath, 'r');
  try {
  // open the file and read the contents, searching for patterns of strings
  // a string starts with a null, a series of bytes that are in the 0x20-0x7E range, and ends with a null

    const buffer = Buffer.alloc(BUFSIZE);
    let inString = false;
    let stringStart = 0;
    let str = '';
    while (true) {
      const r = await f.read(buffer, 0, BUFSIZE, null);
      const bytesRead = r.bytesRead;
      if (bytesRead === 0) {
        break;
      };
      for (let i = 0; i < bytesRead; i++) {
      // if we are in a string, look for the end of the string
        if (inString) {
          if (buffer[i] === 0) {
            inString = false;
            str += buffer.toString('utf8', stringStart, i);
            if (str.length >= minLength) {
              yield str;
            }
            str = '';
            continue;
          }
          if (buffer[i] < 0x20 || buffer[i] > 0x7E) {
            inString = false;
            str = '';
          }
          if (str.length + (i - stringStart) > maxLength) {
            inString = false;
            str = '';
          }
          continue;
        }

        // if we are not in a string, look for the start of a string
        if (buffer[i] === 0) {
          inString = true;
          stringStart = i + 1;
          continue;
        }
      }
      // if we are in a string, add the remaining bytes to the string
      if (inString) {
        str += buffer.toString('utf8', stringStart, bytesRead);
        stringStart = 0;
      }
    }
  } finally {
    // await f.close();
    finalize(f);
  }
}

/** Returns the first match of a string in a binary file */
export async function scanForString(fullPath:any|string|undefined|Promise<string|undefined>, rx:RegExp) {
  for await (const each of getStringsFromFile(fullPath)) {
    const m = rx.exec(each);
    if (m) {
      return m[1]||m[0];
    }
  }
  return false;
}
