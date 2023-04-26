// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { describe, it } from 'mocha';
import { ok, strict, strictEqual } from 'node:assert';
import { hasErrors } from '../sandbox/interfaces';
import { Sandbox } from '../sandbox/sandbox';
import { stringify } from '../system/json';

describe('Sandbox',()=> {
  describe('modules', async () => {
    it('transpile: creates a module from some code',async ()=>{
      const sandbox = new Sandbox();
      const src = `
    import { readFile } from 'fs/promises';

    export default { 
      async read() {
        // console.log("reading");
        return await readFile('${__filename.replace(/\\/g,'/')}',{ encoding:'utf-8' });
      },

      n() {
        return 100;
      }
    }
    `;

      const mod = await sandbox.createModule<{read: ()=>Promise<string>, n: ()=>number}>(src, {filename: 'foo.ts', transpile: true});
      strict(!hasErrors(mod), 'should not have errors');

      strictEqual(Object.getOwnPropertyNames(mod).length,2, 'should have 2 members');

      const contents = await mod.read();
      ok(contents.length > 0, 'should be able to call readFile from exported function');


      strictEqual(mod.n(), 100, 'should be able to access a function, return a value');
    });
  });

  describe('functions',()=>{
    it('transpile: creates an async function from some code',async ()=>{
      const sandbox = new Sandbox();
      const src = `
    import { readFile } from 'fs/promises';

    // console.log("reading");
    return await readFile(filename,{ encoding:'utf-8' });
`;
      const read = await sandbox.createFunction<(filename:string)=>Promise<string>>(src, ['filename'], {filename: 'foo.ts', async: true, transpile: true});
      strict(!hasErrors(read), `should not have errors: ${stringify(read)}`);

      const contents = await read(__filename);
      strict(contents.length > 0, 'should be able to call readFile from exported function');
    });

    it('transpile: fails with errors when the source code is invalid ',async ()=> {
      const sandbox = new Sandbox();
      const src = 'console.log(\'hello world\');\n?';
      const fn = await sandbox.createFunction(src, [], {filename: 'fake.ts', transpile: true});
      strict(hasErrors(fn), 'should have errors');
      strictEqual(fn.length,1, 'should have one error');
      strictEqual(fn[0].code,1128, 'should have 1128: Declaration or statement expected');
    });
  });
});
