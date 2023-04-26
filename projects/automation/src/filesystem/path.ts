// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { delimiter, normalize as norm } from 'path';

import { fail } from 'assert';
import { randomBytes } from 'crypto';
import { Stats } from 'fs';
import { constants, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join, resolve } from 'path';
import { returns } from '../async/returns';
import { isWindows } from '../constants';
import { is } from '../system/guards';


export const normalize = isWindows ? (p: string) => norm(p).toLowerCase(): norm ;

export function pathsFromVariable(environmentVariable: string = 'PATH'): Array<string> {
  return process.env[environmentVariable]?.split(delimiter)||[];
}

export async function filterToFolders(paths: Array<string>): Promise<Array<string>> {
  const set = new Set(paths);
  for (const each of [...set.keys()]) {
    if (!each || !await path.isFolder(each)) {
      set.delete(each);
    }
  }
  return [...set.keys()];
}

export interface Entry {
  name: string;
  fullPath: string;
  isFolder: boolean;
  isFile: boolean;
  isLink: boolean;
}

export interface File extends Entry {
  extension: string;
  basename: string;
  isFolder: false;
  isFile: true;
  isExecutable: boolean;
  size: number;
}

export interface Folder extends Entry {
  isFolder: true;
  isFile: false;
  isExecutable: false;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export class path {
  static async stats(name: string|undefined|Promise<string|undefined>, baseFolder?: string): Promise<[string, Stats|undefined]|[undefined,undefined]> {
    if (is.promise(name)){
      name = await name;
    }

    // if the value isn't a string or has a newline, it ain't a file name
    if (!name || name.indexOf('\n') !== -1) {
      return [undefined, undefined];
    }

    // if we've been given a baseFolder, expand that, otherwise just normalize the value.
    name = baseFolder ? resolve(baseFolder, name): normalize(name);

    return [name, await stat(name).catch(returns.undefined)];
  }

  static async info(name: string|undefined|Promise<string|undefined>, baseFolder?: string, executableExtensions: Set<string> = process.platform === 'win32' ? new Set(['.exe'/* ,'.cmd','.bat' */]): new Set()): Promise<undefined|File|Folder> {
    const [fullPath, stats] = await path.stats(name, baseFolder);
    if (!stats) {
      return undefined;
    }
    // create the entry
    const entry = {
      name:basename(fullPath),
      fullPath,
      isFolder: stats.isDirectory(),
      isFile: stats.isFile(),
      isLink: stats.isSymbolicLink(),
    } as File|Folder;

    if (entry.isFile) {
      entry.size = stats.size;

      if (isWindows) {
        const fp = fullPath.toLowerCase();
        entry.extension = extname(fp);
        entry.basename = basename(fp, entry.extension);
        entry.isExecutable = executableExtensions.has(entry.extension);
        return entry;
      }
      entry.extension = extname(fullPath);
      entry.basename = basename(fullPath, entry.extension);
      // eslint-disable-next-line no-bitwise
      entry.isExecutable =!!(stats.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH));
      return entry;
    }
    if (entry.isFolder) {
      return entry;
    }

    fail(new Error(`Unexpected file type for ${fullPath}`));
  }

  static async isFile(name:any|string|undefined|Promise<string|undefined>, baseFolder?: string): Promise<undefined|string> {
    const [fullName, stats]=await path.stats(name, baseFolder);
    return stats?.isFile() ? fullName : undefined;
  }

  static async isFolder(name:string|undefined|Promise<string|undefined>, baseFolder?: string): Promise<undefined|string> {
    const [fullName, stats]=await path.stats(name, baseFolder);
    return stats?.isDirectory() ? fullName : undefined;
  }

  static async isExecutable(name:string|undefined|Promise<string|undefined>, baseFolder?: string): Promise<undefined|string> {
    const info=await path.info(name, baseFolder);
    return info?.isFile && info.isExecutable ? info.fullPath : undefined;
  }

  static parent(name: Promise<string|undefined>): Promise<string|undefined>;
  static parent(name: string|undefined): string|undefined;
  static parent(name: string|undefined|Promise<string|undefined>): string|undefined|Promise<string|undefined> {
    return is.promise(name) ? name.then(path.parent) : name ? normalize(resolve(name, '..')) : undefined;
  }
}
export function tmpFile(prefix='tmp.', suffix = '.tmp', folder = tmpdir()) {
  return join(folder, prefix + randomBytes(32).toString('hex') + suffix);
}
