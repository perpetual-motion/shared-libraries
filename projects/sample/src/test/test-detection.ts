/* eslint-disable header/header */

import { readdir, readFile } from 'fs/promises';
import { describe, it } from 'mocha';
import { resolve } from 'path';
import { detectCompilers } from '../compiler-detection/compiler-detection';
import { validateDefinitionFile } from '../compiler-detection/interfaces.validator';

const root = resolve(__dirname,'..','..','src','test','definitions');

class Stopwatch {
  private start: number;
  private last: number;

  constructor() {
    this.last = this.start = Date.now();
  }

  lap(text: string) {
    const elapsed = Date.now() - this.last;
    console.log(`[${elapsed}ms] ${text}`);
    this.last = Date.now();
  }

  total(text: string) {
    const elapsed = Date.now() - this.start;
    console.log(`[Total: ${elapsed}ms] - ${text}`);
  }
}

function start() {
  const stopwatch = new Stopwatch();
  const result = (text:string)=> stopwatch.lap(text);
  result.total = (text:string)=> stopwatch.total(text);
  return result;
}

describe('Detect Compilers', () => {
  it('validates the files first',async ()=>{
    for (const name of await readdir(root)) {
      const fullPath = resolve(root,name);
      if (fullPath.endsWith('.json')) {
        console.log(fullPath);
        const content = await readFile(resolve(root,name),'utf8');
        const er1 = validateDefinitionFile(content).map(each => each.message).join('\n');
        for (const err of validateDefinitionFile(content).filter(each => each.category === 1)) {

          throw new Error(`${fullPath} - ${er1}`);
        }
      }
    }
  });

  it('can find some compilers',async ()=> {
    const lap = start();
    console.log(`START===================================${root}`);
    let first = true;

    // await loadCompilerDefinitions([root]);
    // lap('loaded definitions');
    const queries = [];
    for await (const each of detectCompilers([root])) {
      if (first) {
        first = false;
        lap('Discovery scan returned first result\n');
      }

      lap(`Detected Compiler ${each.name}/${each.version}`);
      queries.push(each.query().then(()=> {
        lap(`  query results: ${each.name}/${each.version}
     Path: ${each.compilerPath}
     Include Paths: ${each.includePath}
     #defines: ${Object.entries(each.defines).length}
     CStandard: ${each.cStandard || 'none'}
     CppStandard: ${each.cppStandard || 'none'}
     Target: ${JSON.stringify(each.target)}
   `);

      }));

      // */

    };
    await Promise.all(queries);
    lap.total('Total');

  });
});
