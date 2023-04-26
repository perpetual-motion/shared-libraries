// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { notStrictEqual } from 'assert';
import { parse } from 'comment-json';
import { readdir, readFile } from 'fs/promises';
import { describe, it } from 'mocha';
import { resolve } from 'path';

import { validateDefinitionFile } from '../compiler-detection/interfaces.validator';

const root = resolve(__dirname,'..','..','src','test','validation-tests');
describe('Toolset Definition Validator', () => {
  it('handles inputs that pass validation',async ()=> {
    for (const name of await readdir(root)) {
      const content = await readFile(resolve(root,name),'utf8');

      if (name.startsWith('good-')) {
        // validate it as a string first
        for (const err of validateDefinitionFile(content).filter(each => each.category === 1)) {
          throw new Error(err.message);
        }

        // validate it after deserializing it as an object
        for (const err of validateDefinitionFile(parse(content)).filter(each => each.category === 1)) {
          throw new Error(err.message);
        }
        continue;
      }

      if (name.startsWith('bad-')) {
        // validate it as a string first
        const errors = validateDefinitionFile(content);
        notStrictEqual(errors.length,0,`Expected errors for ${name}`);

        const errors2 = validateDefinitionFile(parse(content));
        notStrictEqual(errors2.length,0,`Expected errors for ${name}`);


        continue;
      }
    }
  });
});