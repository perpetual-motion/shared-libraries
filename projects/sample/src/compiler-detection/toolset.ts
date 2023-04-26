/* eslint-disable header/header */

import { all, cmdlineToArray, Command, path, render, tmpFile } from '@perpetual-motion/automation';
import { unlinkSync, writeFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, sep } from 'path';
import { runConditions } from './definition';
import { CppStandard, CStandard, DefinitionFile, OneOrMore, Target } from './interfaces';
import { toCppStandard, toCStandard } from './interfaces.validator';
import { mergeObjects } from './object-merge';
import { nativePath, strings } from './strings';

const flags = new Map<any, Set<string>>();
function hasFlag(key: any, text: string) {
  return flags.get(key)?.has(text);
}

function setFlag(key: any, text: string) {
  if (!flags.has(key)) {
    flags.set(key, new Set());
  }
  flags.get(key)!.add(text);
}


/**
 * The Toolset is the final results of the [discovery+query] process
 *
 * This is the contents that we're going to eventually pass to the back end.
 */
export class Toolset  {
  #definition: DefinitionFile;
  #defines: Record<string, string> = {};
  #includePaths = new Set<string>();
  #forcedIncludes = new Set<string>();
  #additionalProperties = {} as Record<string,OneOrMore<string>>;
  #target = {} as Target;

  /** The #defines that are implicitly specified */
  get defines(): Record<string, string> {
    return { ...this.#definition.defaults?.defines, ...this.#defines };
  }

  set defines(value: Record<string, string>) {
    mergeObjects(this.#defines, value);
  }

  /** The full set of default #include paths */
  get includePath(): Array<string> {
    return [...this.#includePaths];
  }

  /** The name of the toolset (this is shown to the user) */
  get name(): string {
    return this.#definition.name;
  }

  /** The version of the toolset (this is shown to the user) */
  get version(): string {
    return this.#definition.version ?? 'unknown';
  }

  set version(value: string) {
    this.#definition.version = value;
  }

  /** The full (verified) path to the compiler */
  readonly compilerPath: string;

  /** The C++ standard that this toolset supports */
  cppStandard?: CppStandard;

  /** The C Standard that this toolset supports */
  cStandard?: CStandard;

  /** The settings for what the toolset is targeting */
  get target(): Target {
    return { ...(this.#definition.defaults?.target || {}) as Target, ...this.#target };
  }

  /** paths to files that are forcibly #included */
  get forcedInclude(): Array<string> {
    return [ ...strings(this.#definition.defaults?.forcedInclude), ...this.#forcedIncludes];
  }

  /** unstructured data that can be passed thru to help the backend figure out what to do */
  get additionalProperties(): Readonly<Record<string,OneOrMore<string>>> {
    return { ...this.#definition.defaults?.additionalProperties, ...this.#additionalProperties };
  }

  constructor(compilerPath: string,defintion: DefinitionFile, private resolver: (prefix: string, expression: string) => any) {
    this.#definition = defintion;
    this.compilerPath = compilerPath;
  }

  async query() {
    do {
      // create a command for the binary (ensure that the binary's folder is in the path at the front)
      const cmd = await new Command(this.compilerPath,{env: {PATH: `${dirname(this.compilerPath)}${sep}${process.env.PATH}` }});

      await Promise.all(Object.entries(this.#definition.query!).filter(([cmdline,block])=> !hasFlag(this, cmdline)).map(async ([cmdline,block]) => {

        setFlag(this,cmdline); // never run the same command line again
        const tmpFiles = new Array<string>();
        let stdout = '';
        let stderr = '';

        const args = cmdlineToArray(render(cmdline,this.#additionalProperties,(prefix,expression)=> {

          if (prefix === 'tmp') {
            // creating temp files
            const tmp = tmpFile('tmp.',`.${expression}`);
            writeFileSync(tmp,'');
            tmpFiles.push(tmp);
            switch (expression) {
              case 'stdout':
                stdout = tmp;
                break;
              case 'stderr':
                stderr = tmp;
                break;
            }
            return tmp;
          }
          return this.resolver(prefix, expression);
        }));
        const out = await cmd(...args);

        let text = [...out.console.all(),...out.error.all()].join('\n');
        if (stdout) {
          text += await readFile(stdout,'utf8');
        }

        tmpFiles.forEach(each => unlinkSync(each));

        for (const [variable,rxes] of Object.entries(block)) {

          for (const rx of strings(rxes)) {
            // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
            const values = [...text.matchAll(new RegExp(rx,'gm'))].map(each => each.slice(1).map(each => each?.split?.(/\n |\n/).filter(each=>each).map(each=>each.trim()) || each).flat());

            switch (variable) {
              case 'defines':
                for (const each of values) {
                  this.#defines[each[0]] = each[1] ?? '1';
                }
                break;

              case 'includePath':
                for (const each of values) {
                  // add each value to the include path, no duplicates
                  await all(each.map(path=> nativePath(path)).map(async each => {if (await path.isFolder(each)) { this.#includePaths.add(each); }}));
                }
                break;

              case 'forcedInclude':
                for (const each of values) {
                  // add each value to the forcedIncludes, no duplicates
                  await all(each.map(path=> nativePath(path)).map(async each => {if (await path.isFile(each)) { this.#forcedIncludes.add(each); }}));
                }
                break;

              case 'cppStandard':
                this.cppStandard = toCppStandard(values) || this.cppStandard;
                break;

              case 'cStandard':
                this.cStandard =  toCStandard(values) || this.cStandard;
                break;

              case 'version':
                this.version = values[0][0] || this.version;
                break;

                // these are not directly settable, but we'll add them to the additional properties bucket.
              case 'target':
                this.#additionalProperties[variable] = values[0][0];
                break;

              default:
                // we can override the default properties if necessary
                if (variable in this) {
                  (this as Record<string,any>)[variable] = values.flat(3)[0];
                  break;
                }

                // everything else goes in additional properties.
                const flat =values.flat();

                if (this.additionalProperties[variable]) {
                  // combine the values if there are already values
                  const all = strings(this.#additionalProperties[variable]) as Array<string>;
                  all.push(...flat);
                  this.#additionalProperties[variable] = all;
                  break;
                }
                // just set the value
                switch (flat.length) {
                  case 0:
                    // set nothing.
                    break;
                  case 1:
                    if (flat[0]){
                      // if there is a value, set it.
                      this.#additionalProperties[variable] = flat[0];
                    }
                    break;
                  default:
                    // set the array
                    this.#additionalProperties[variable] = flat;
                }
            }
          }
        }
      }));
    } while (runConditions(this.#definition,this.resolver));
  }
}

/**
 *
 *     const defaults = definition.defaults || {};
    const defines = defaults.defines || {} as Record<string,string>;
    const includePath = new Set(strings(defaults.includePath));
    const target = defaults.target || {} as Target;
    const forcedInclude = new Set(strings(defaults.forcedInclude));

    const expand = (value: string) => render(value,additionalProperties,resolver);
    const expandPaths = (value: string) => nativePath(expand(value));


    const result = {
      name: definition.name,              // name of the toolset
      version: additionalProperties.version || definition.version,        // defaults to the version in the definition file, can be overridden

      compilerPath: nativePath(compilerPath), // set to the full path of the compiler
      defines,
      includePath: strings(includePath).map(expandPaths), // convert to native paths
      target,
      forcedInclude: strings(forcedInclude),
      additionalProperties: additionalProperties as Record<string,OneOrMore<string>>,

      query: async ()=> {}, // default - do nothing unless they actually specified a query block
    } as Toolset;

    // run the conditions now, just to see if they have any conditions that are already met
    runConditions(definition,resolver);
 */