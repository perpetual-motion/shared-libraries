// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { Async } from '../../async/constructor';
import { sleep } from '../../async/sleep';
import { debug } from '../../eventing/channels';

/* eslint-disable @typescript-eslint/naming-convention */
export const Something = Async(class Something {
  hasBeenInitialized: boolean = false;
  constructor(public num:number){
    if (num === -1) {
      throw new Error('constructor throws on -1');
    }
  }

  async init(num:number): Promise<Something> {
    if (this.num === -2) {
      throw new Error('init throws on -2');
    }
    // ensure that this is delayed by 100ms
    await(sleep(100));

    this.hasBeenInitialized = true;
    return this;
  }

  comment() {
    debug(`Has this been initialized: ${this.hasBeenInitialized}`);;
  }
});

export const SomethingElse = Async(class SomethingElse {
  works = true;
});

export const AnotherOne = Async(class AnotherOne {
  init: Promise<void>;
  works = false;
  constructor() {
    this.init = sleep(1).then(()=> {this.works = true;});
  }
});

export const AnotherTwo = Async(class AnotherTwo {
  async init() {
    await sleep(1);
    this.works = true;
  }
  works = false;
  constructor() {

  }
});


export const AnotherThree = Async(class AnotherThree extends AnotherTwo.class {
  override async init() {
    console.log(`before calling super.init, works == ${this.works}`);
    await super.init();
    console.log(`after calling super.init, works == ${this.works}`);
  }
});
