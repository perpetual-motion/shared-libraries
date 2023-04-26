// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { Context, createContext, runInContext, Script } from 'vm';
import { debug, error, info, verbose, warning } from '../eventing/channels';
import { stringify } from '../system/json';
import { ArbitraryModule, CreateOptions, hasErrors, ScriptError } from './interfaces';
import { transpile } from './transpiler';

/**
 * Creates a reusable safe-eval sandbox to execute code in.
 */
export function createSandbox(): <T>(code: string, context?: any) => T {
  const sandbox = createContext({});
  return (code: string, context?: any) => {
    const response = `SAFE_EVAL_${Math.floor(Math.random() * 1000000)}`;
    sandbox[response] = {};
    if (context) {
      Object.keys(context).forEach((key) => (sandbox[key] = context[key]));
      runInContext(
        `try {  ${response} = ${code} } catch (e) { ${response} = undefined }`,
        sandbox
      );
      for (const key of Object.keys(context)) {
        delete sandbox[key];
      }
    } else {
      try {
        runInContext(`${response} = ${code}`, sandbox);
      } catch (e) {
        sandbox[response] = undefined;
      }
    }
    return sandbox[response];
  };
}

export const safeEval = createSandbox();

const filterErrorCodes = [
  2307, // Cannot find module (we're not having the compiler resolve or verify those, it'll happen at runtime.)
  2410, // the 'with' statement is not supported. (too bad!)
];

// filter out these errors when creating modules.
const filterErrorCodesForFunction = [
  ... filterErrorCodes,
  1378, // 'await' expressions are only allowed within async functions and at the top levels of modules.
  2304, // cannot find name 'xxx'
];

/**
 * A class that provides the ability to execute code from the user in a safe way.
 * (it does so using node's VM support, which isn't considered "BULLET PROOF" but it should be pretty darn good.)
 */
export class Sandbox{
  context: Context;

  constructor(initializeContext: Record<string,any> = {}) {
    this.context = createContext({
      exports: {},
      ... initializeContext,
      require: (m: string) => this.require(m),
      console: {
        log: (...args: Array<any>) => args.forEach(each => info(each)),
        error: (...args: Array<any>) => args.forEach(each => error(each)),
        debug: (...args: Array<any>) => args.forEach(each => debug(each)),
        info: (...args: Array<any>) => args.forEach(each => info(each)),
        warning: (...args: Array<any>) => args.forEach(each => warning(each)),
        verbose: (...args: Array<any>) => args.forEach(each => verbose(each)),
      },
      JSON: {
        stringify: (obj: any) => stringify(obj),
        parse: (str: string) => JSON.parse(str),
      },

    });
  }

  protected require(module:string) {
    // out(`// requiring (${module})`);
    return require(module);
  }

  /**
   * Creates a javascript module from the given source code.
   *
   *
   * @param sourceCode the source code to create a module from
   * @param options the creation options
   * @return an array of errors if there were any
   * @returns an object containing the module exports
   */
  async createModule<T = ArbitraryModule>(sourceCode: string, options?: CreateOptions) :Promise<Array<ScriptError> | T>{
    // insert defaults in options
    options = {
      lineOffset: 0,
      columnOffset: 0,
      filename: '<sandbox>' ,
      ...options ? options : {},
    };

    // create the project, parse the code and check for errors
    const result = await transpile(sourceCode, options.filename!, filterErrorCodes);

    // if we have errors, return them instead.
    if (Array.isArray(result)) {
      return result;
    }

    // if we don't think there are any errors
    // emit the code, wrap it in a function
    const scriptSrc = result.
      replace(/^(\/\/# sourceMappingURL=)/gm,'exports[\'default\']\n$1');

    // create the script object, run it, and capture the generated function
    try {
      return new Script(scriptSrc,options).runInContext(this.context,{});
    } catch (e:any) {

      // todo: resolve the actual filename/line/etc from the error
      // which involves parsing the stack trace, and then looking up the source map?
      return [{
        code: 999999,
        message: e.message,
        column: 1,
        line: 1,
        file: options!.filename!,
        category: 0,
        offset: 0,
      }];
    }
  }

  /**
   * Creates an adhoc function from raw JS/TS code.
   *
   * This wraps raw javascript code into a function with some interesting caveats:
   *  - It uses the TS compiler to do some basic syntax checking, and transform import statements into require statements.
   *  - It has to do some magic to get 'return' statements to work correctly
   *  - it suppresses some errors from the TS compiler about the use of 'await' at the top-level and module imports.
   *    (no worries, this is expected)
   *
   * @param sourceCode the code to turn into a function
   * @param parameterNames the names of the parameters to generate for the function
   * @param options Function Creation Options
   * @return an array of errors if there were any
   * @returns a function that can be called with the given parameters
   */
  createFunction<T = ((...args: Array<any>) => unknown)>(sourceCode: string,parameterNames: Array<string>, options?: CreateOptions & {async?: false, transpile?: false}) : Array<ScriptError> | T
  createFunction<T = ((...args: Array<any>) => Promise<unknown>)>(sourceCode: string,parameterNames: Array<string>, options: CreateOptions & {async: true, transpile?: false|undefined}) : Array<ScriptError> | T

  createFunction<T = ((...args: Array<any>) => unknown)>(sourceCode: string,parameterNames: Array<string>, options?: CreateOptions & {async?: false, transpile: true}) : Promise<Array<ScriptError> | T>
  createFunction<T = ((...args: Array<any>) => Promise<unknown>)>(sourceCode: string,parameterNames: Array<string>, options: CreateOptions & {async: true, transpile: true}) : Promise<Array<ScriptError> | T>
  createFunction<T = ((...args: Array<any>) => unknown)>(sourceCode: string,parameterNames: Array<string> = [], options?: CreateOptions & {async?: boolean}) : Array<ScriptError> | T | Promise<Array<ScriptError> | T> {
    // insert defaults in options
    options = {
      lineOffset: 0,
      columnOffset: 0,
      filename: '<sandbox>',
      transpile: false,
      ...options ? options : {},
    };

    let scriptSrc = sourceCode;

    if (options.transpile) {
      return transpile(sourceCode, options.filename!, filterErrorCodesForFunction, {rawFunction: true}).then(result => {
      // create the project, parse the code and check for errors

        // if we have errors, return them instead.
        if (hasErrors(result)) {
          return result;
        }

        // if we don't think there are any errors
        // emit the code, wrap it in a function
        scriptSrc = `${options!.async?'async ':''}(${parameterNames.join(',')}) => {` +

        result.
        // wrap the code in an function
          replace(/^"use strict";/gm, '').

        // remove the 'exports' property creation
          replace(/Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);/gm, '                                                              ').

        // restore the return statements
          replace(/\/\*\\R\/\*\//gm,'return').

        // close the function before the source map declaration
          replace(/^(\/\/# sourceMappingURL=)/gm,'}\n$1');
        try {
          return new Script(scriptSrc,options).runInContext(this.context,{});
        } catch (e:any) {

          // todo: resolve the actual filename/line/etc from the error
          // which involves parsing the stack trace, and then looking up the source map?
          return [{
            code: 999999,
            message: e.message,
            column: 1,
            line: 1,
            filename: options!.filename!,
          }];
        }

      });
    }

    // if we don't have to invoke the transpiler, this is simple, and a lot cheaper.
    // (but we don't get any fancy errors if it's not valid javascript, so, this should be used when it's not unverified user input)
    scriptSrc = `${options.async?'async ':''}(${parameterNames.join(',')}) => { ${scriptSrc} }`;

    // create the script object, run it, and capture the generated function
    return new Script(scriptSrc,options).runInContext(this.context,{});
  }
}

