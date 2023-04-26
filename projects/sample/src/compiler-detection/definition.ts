/* eslint-disable header/header */

import { all, Finder, is, render, safeEval } from '@perpetual-motion/automation';
import { parse } from 'comment-json';
import { readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { DefinitionFile, PartialDefinitionFile, PkgMgr } from './interfaces';
import { validateDefinitionFile, validatePartialDefinitionFile } from './interfaces.validator';
import { mergeObjects } from './object-merge';
import { error, warn } from './shims';
import { strings } from './strings';


function isToolsetDefinition(definition: any): definition is DefinitionFile {
  // ensure we have a valid object
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    return false;
  }

  // do an interface check, if there are any errors, return false.
  return !validateDefinitionFile(definition).some(each => each.category === 1);
}

function isPartialToolsetDefinition(definition: any): definition is DefinitionFile {
  // ensure we have a valid object
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    return false;
  }
  const errors =validatePartialDefinitionFile(definition).filter(each => each.category === 1);
  if (errors.length){
    error(errors.map(each => each.message).join('\n'));
  }
  // do an interface check, if there are any errors, return false.
  return !errors.length;
}

const compilerDefintions = new Map<string, DefinitionFile>();
const partialDefinitions = new Map<string, PartialDefinitionFile>();

/** coerce the collections from OneOrMore<*> to Array<*> in the defintion  */
function coerceCollections(definition:DefinitionFile) {
  // definition.package.* = strings(definition.package.*);
  if (definition.package) {
    for (const key of Object.keys(definition.package)){
      definition.package[key as PkgMgr] = strings(definition.package[key as PkgMgr]);
    }
  }

  // definition.query.*.* = toArray(definition.query.*.*);
  if (definition.query){
    for (const key of Object.keys(definition.query)){
      for (const key2 of Object.keys(definition.query[key])) {
        definition.query[key][key2] = strings(definition.query[key][key2]);
      }
    }
  }

  if (definition.discover) {
    definition.discover.binary = strings(definition.discover.binary);
    definition.discover.locations = strings(definition.discover.locations);
  }

  if (definition.defaults) {
    definition.defaults.includePath = strings(definition.defaults?.includePath);
    definition.defaults.forcedInclude = strings(definition.defaults?.forcedInclude);
  }
}

async function loadDefinition(definitionFile: string) {
  if (!compilerDefintions.has(definitionFile)) {
    try {
      const definition = parse(await readFile(definitionFile, 'utf8'));
      if (!isToolsetDefinition(definition)) {
        error(`The definition file ${definitionFile} is not a valid toolset definition.`);
        return;
      }


      coerceCollections(definition);
      if (definition.import) {
        const files = strings(definition.import);
        for (const file of files){
          // there should be a partial definition file that matches this expression
          const partialFile = resolve(dirname(definitionFile),file);
          await loadPartialDefinition(partialFile);

          if (partialDefinitions.has(partialFile)){
            const partial = partialDefinitions.get(partialFile)!;
            if (!isPartialToolsetDefinition(partial)){
              continue;
            }
            mergeObjects(definition, partial);
            coerceCollections(definition);
          }
        }
      }

      if (definition.conditions){
        // eslint-disable-next-line prefer-const
        for (let [expression,part] of Object.entries(definition.conditions)){
          if (is.string(part) || is.array(part)){
            const files = strings(part);
            part = {};
            for (const file of files){
              // there should be a partial definition file that matches this expression
              const partialFile = resolve(dirname(definitionFile),file);
              await loadPartialDefinition(partialFile);

              if (partialDefinitions.has(partialFile)){
                const partial = partialDefinitions.get(partialFile)!;
                if (!isPartialToolsetDefinition(partial)){
                  continue;
                }
                mergeObjects(part, partial);
                coerceCollections(definition);
              }
            }
          }
          if (isPartialToolsetDefinition(part)){
            // replace the location with the contents
            definition.conditions[expression] = part;
          }
        }
      }
      compilerDefintions.set(definitionFile, definition);
    } catch (e:any) {
      if (e.message) {
        warn(`Error loading compiler definition file: ${definitionFile} - ${e.message}`);
      }
    }
  }
}

async function loadPartialDefinition(definitionFile: string) {
  if (!partialDefinitions.has(definitionFile)) {
    const definition = parse(await readFile(definitionFile, 'utf8'));
    if (!isPartialToolsetDefinition(definition)){
      error(`Error loading partial compiler definition file: ${definitionFile} - Invalid definition file.`);
      return;
    }

    if (definition.import) {
      const files = strings(definition.import);
      for (const file of files){
        // there should be a partial definition file that matches this expression
        const partialFile = resolve(dirname(definitionFile),file);
        await loadPartialDefinition(partialFile);

        if (partialDefinitions.has(partialFile)){
          const partial = partialDefinitions.get(partialFile)!;
          if (!isPartialToolsetDefinition(partial)){
            continue;
          }
          mergeObjects(definition, partial);
          coerceCollections(definition);
        }
      }
    }

    partialDefinitions.set(definitionFile, definition);
  }
}

export async function loadCompilerDefinitions(configurationFolders:Array<string>) {
  // find all the definition files in the specified configuration folders.
  const files = await new Finder((file)=> file.extension === '.json' && file.basename.startsWith('toolset.')).scan(...configurationFolders).results;

  // read all the definition files
  await all(...[...files].map(loadDefinition));

  return compilerDefintions.values();
}

export function runConditions(definition: DefinitionFile, resolver: (prefix: string, expression: string) => string): boolean {
  let conditionsRan = false;
  if (definition.conditions) {
    for (const [expression,part] of Object.entries(definition.conditions)){
      if (safeEval(render(expression, {}, resolver,true))) {
        // the condition is true!
        // which means something changed...
        conditionsRan =true;

        // remove the condition from the definition so we don't re-run it
        delete definition.conditions[expression];

        // merge the part into the main document
        mergeObjects(definition,part as any);
        coerceCollections(definition);

        // we should also run the conditions again, in case the new definition has more conditions
        runConditions(definition,resolver);
      }
    }

    return conditionsRan;
  }
  return false;
}