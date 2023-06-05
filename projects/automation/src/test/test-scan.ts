// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { describe, it } from 'mocha';
import { start } from '../eventing/channels';
// import { Finder, scanFolder } from '../filesystem/async-finder';
import { Finder as OldFinder } from '../filesystem/find';
import { filterToFolders, pathsFromVariable } from '../filesystem/path';

describe('Scan for executables', () => {
  it('can scan the whole pgm files folders', async () => {
    const searchPaths = await filterToFolders(pathsFromVariable('PATH'));
    const elapsed = start();

    {
      const finder = new OldFinder(/st.*link/i);
      finder.scan(...searchPaths);
      // eslint-disable-next-line dot-notation
      finder.scan(5,process.env['HOME']! || process.env['USERPROFILE']!);
      finder.scan(10,'c:\\st', 'c:\\program files', 'c:\\program files (x86)');

      for (const each of await finder.results) {
        console.log(each);
      }
      elapsed('Scanned all locations ');
    }
  });
});

/*
describe('Use the async scanner', () => {
  it('Just scan whole pgm files folders', async () => {
    const searchPaths = await filterToFolders(pathsFromVariable('PATH'));
    const elapsed = start();
    for await (const each of scanFolder('c:/program files',5)) {
      if (each.isExecutable) {
        console.log(each.fullPath);
      }
    }
    elapsed('Scanned all locations ');
  });
  it('can scan the whole pgm files folders', async () => {
    const searchPaths = await filterToFolders(pathsFromVariable('PATH'));
    const elapsed = start();

    {
      const finder = new Finder(/st.*link/i);
      finder.scan(...searchPaths);
      // eslint-disable-next-line dot-notation
      finder.scan(5,process.env['HOME']! || process.env['USERPROFILE']!);
      finder.scan(10,'c:\\st', 'c:\\program files', 'c:\\program files (x86)');

      for await (const each of finder.results) {
        console.log(each.fullPath);
      }
      elapsed('Scanned all locations ');
    }
  });
});
*/