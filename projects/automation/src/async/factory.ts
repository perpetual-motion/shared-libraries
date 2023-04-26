// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.
/* eslint-disable @typescript-eslint/naming-convention */

import { is } from '../system/guards';
import { Reject, Resolve } from './internals';

type WithInit<TOutput> = TOutput & {init?: (...args:Array<any>) => any | Promise<any> };

export function Factory<TFactory extends (...args: Parameters<TFactory>) => ReturnType<TFactory>>(factory: TFactory) : new (...args: Parameters<TFactory>) => Promise<Awaited<ReturnType<TFactory>>> {
  /** calls/awaits any .init in the result from the factory */
  async function initialize(instance: WithInit<ReturnType<TFactory>> | Promise<WithInit<ReturnType<TFactory>>>, args: Array<any>) {
    if (instance !== null && instance !== undefined) {
      if (is.promise(instance)) {
        instance = await instance;
      }

      // if .init is a function, call it, if it's a promise, await it
      const pInit = typeof instance.init === 'function' ? instance.init(args) : instance.init;
      if (is.promise(pInit)) {
        await pInit;
      }
    }
    return instance;
  }

  class AsyncFactory extends Promise<ReturnType<TFactory>> {
    protected factory: TFactory ;
    constructor(...args: Array<any>) {
      if (args.length === 1 && typeof args[0] === 'function') {
        // this is being called because a new Promise is being created for an async function invocation (not user code)
        super(args[0]);
        this.factory = factory;
        return;
      }

      // this is being called because a user is creating an instance of the class, and we want to call the init() method
      super((resolve:Resolve<ReturnType<TFactory>>,reject:Reject)=>{
        try {
          // call the factory with the arguments that they provided, then initialize it
          initialize(factory(...(args as any)) as any, args).then(resolve).catch(reject);
        } catch (error) {
          // if the constructor throws, we should reject the promise with that error.
          reject(error);
        }
      });
      this.factory = factory;
    }
  }

  return AsyncFactory as any as { new(...args: Parameters<TFactory>): Promise<Awaited<ReturnType<TFactory>>> };
}