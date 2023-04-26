// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { constants, readdir, stat } from 'fs/promises';
import { basename, extname, sep } from 'path';
import { combine, reiterable } from '../async/awaiters';
import { returns } from '../async/returns';
import { isWindows } from '../constants';

import { File, Folder, normalize, path } from './path';

type FullPath = string;

const cache = new Map<FullPath,AsyncIterable<File|Folder>>();
const set = new Set<string>();

// this doesn't use the path.info function becuase in this case, the direntry is already available, and on windows we can skip a call to stat (which is expensive)
async function* processFolder(fullPath: string,executableExtensions: Set<string>) : AsyncIterable<File|Folder> {
  if (set .has(fullPath)) {
    console.log(`Already processing ${fullPath}`);
  }
  set.add(fullPath);
  for (const direntry of await readdir(fullPath, { withFileTypes: true }).catch(returns.none)) {
    const name = direntry.name;

    // create the entry
    const entry = {
      name,
      fullPath: `${fullPath}${sep}${name}`,
      isFolder: direntry.isDirectory(),
      isFile: direntry.isFile(),
      isLink: direntry.isSymbolicLink(),
    } as File|Folder;

    if (entry.isFile) {
      if (isWindows) {
        entry.extension = extname(name.toLowerCase());
        entry.isExecutable = executableExtensions.has(entry.extension);
        entry.basename = basename(name, entry.extension);
      } else {
        entry.basename = basename(name);
        // in non-windows platforms, we need to check the file mode to see if it's executable.
        const stats = await stat(entry.fullPath).catch(returns.undefined);
        if (!stats) {
          continue;
        }
        // eslint-disable-next-line no-bitwise
        entry.isExecutable = !!(stats.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH));
        entry.extension = extname(name);
      }

      yield entry;
      continue;
    }
    if (entry.isFolder) {
      // it's a folder, so let's lazily queue up it's children
      // entry.children = lazy(()=>readDirectory(entry.fullPath, executableExtensions));
      yield entry;
    }
  };
}

async function* readDirectory(fullPath: string|Promise<string>,executableExtensions: Set<string> = process.platform === 'win32' ? new Set(['.exe'/* ,'.cmd','.bat' */]): new Set()) : AsyncIterable<File|Folder> {
  fullPath = (await path.isFolder(fullPath))!;

  if (!fullPath){
    // not a folder, so return nothing
    return;
  }

  let folder = cache.get(fullPath);
  if (!folder) {
    // this folder has not been asked for yet.
    cache.set(fullPath, folder = reiterable(processFolder(fullPath, executableExtensions)));
  }

  return yield* folder;
}

export async function* scanFolder(folder: string, scanDepth: number, filePredicate?: (file: File) => Promise<boolean>|boolean,folderPredicate?: (folder: Folder) => Promise<boolean>|boolean):AsyncIterable<File|Folder> {
  // should not have depth less than 0
  if (scanDepth < 0) {
    return;
  }

  // normalize the folder
  folder = normalize(folder);

  // create a combined iterator that will yield all the files and folders
  const all = combine(readDirectory(folder));

  for await (const each of all) {
    if (each.isFile) {
      if (!filePredicate || await filePredicate(each)) {
        yield each;
      }
      continue;
    }
    if (!folderPredicate || await folderPredicate(each)) {
      // if we're still going deeper, then queue up the children
      if (scanDepth) {
        console.log(`Scanning ${each.fullPath} ${scanDepth}`);
        all.add(scanFolder(each.fullPath, scanDepth - 1, filePredicate, folderPredicate));
      }
    }
  };
}


/** The Finder searches paths to find executable given a name or regular expression.
 *
 * It can scan multiple paths, and can be configured to exclude folders.
 * It can also scan into subfolders of the given folders to a specified depth.
 *
 */
export class Finder {
  #excludedFolders = new Set<string|RegExp>(['winsxs','syswow64','system32']);
  files = new Set<string>();
  private match: (file: File) => Promise<boolean>|boolean;
  private combined = combine<File|Folder>();

  constructor(executableName:string)
  constructor(executableRegEx:RegExp)
  constructor(fileMatcher:(file: File) => Promise<boolean>|boolean)
  constructor(binary:string|RegExp|((file: File) => Promise<boolean>|boolean)) {
    switch (typeof binary) {
      case 'string':
        this.match = (file: File) => file.isExecutable && file.basename === binary;
        break;
      case 'function':
        this.match = binary;
        break;
      case 'object':
        this.match = (file: File) => file.isExecutable && !!file.basename.match(binary);
        break;
    }
  }

  exclude(folder: string) {
    this.#excludedFolders.add(folder);
  }

  /**
   * Add one or more locations to scan, with an optionally specified depth.
   *
   * The scanning of those locations begins immediately and is done asynchronously.
   *
   */
  scan(...location:Array<Promise<string>|string>):Finder
  scan(depth:number, ...location:Array<Promise<string>|string>):Finder
  scan(...location:Array<Promise<string>|string|number>):Finder {
    const depth = typeof location[0] === 'number' ? location.shift() as number : 0;
    for (const each of location) {
      this.combined.add(scanFolder(each.toString(), depth, this.match, (f)=>!this.#excludedFolders.has(f.name)));
    }

    return this;
  }

  readonly results = reiterable(this.combined);
}