// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { notStrictEqual, strictEqual } from 'assert';
import { describe, it } from 'mocha';
import { Command, Program } from '../automation/program';
import { Descriptors } from '../eventing/descriptor';
import { notifyNow } from '../eventing/dispatcher';
import { EventData } from '../eventing/interfaces';

describe('Program Automation', () => {
  it('can run a program', async ()=>{

    const echo = await new Program('c:/windows/system32/cmd.exe', '/c', 'echo');
    const p = await echo('hello');

    await p.exitCode;

    strictEqual(p.all()[0], 'hello', 'echo should echo the text we sent it');

    const echo2 = await new Program(echo, 'with','some','text');
    const p2 = await echo2('there');
    await p2.exitCode;

    strictEqual(p2.all()[0], 'with some text there', 'echo should echo the text we sent it');
  });

  it('can do other stuff too',async()=>{

    let count =0;

    const echo = await new Program('c:/windows/system32/cmd.exe', '/c', 'echo',{
      on: {
        'this console/read': async (event:EventData<undefined>) => {
          if (event.text === 'sample-text') {
            count++;
          }
          notStrictEqual(event.text,'should-not-see', 'should not have seen this text');
        }
      }
    });

    const p = await echo('sample-text');

    // send an arbitrary console event, this should not show up with 'this' set in the handler above.
    notifyNow('read',new Descriptors(undefined, {console:''}), 'should-not-see');

    await p.exitCode;

    strictEqual(count, 1, 'should have seen the text we tried to echo');
  });

  it('runs a node command, filter the output', async () => {

    // create a command that runs node from this process
    const node = await new Command(process.execPath);

    // run the command with the --version argument
    const out = (await node('--version')).console.filter(/v(\d+\.\d+\.\d+)/g);

    // verify that we got what we expect
    strictEqual(out.length, 1, 'should have found the version number');
    strictEqual(out[0], process.versions.node, 'should have found the version number');

    console.log(out);

  });
});
