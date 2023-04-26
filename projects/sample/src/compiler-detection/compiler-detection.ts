/* eslint-disable header/header */

import { combine, filterToFolders, Finder, path, pathsFromVariable, render, scanForString } from '@perpetual-motion/automation';
import { homedir } from 'os';
import { basename, delimiter, resolve, sep } from 'path';
import { loadCompilerDefinitions, runConditions } from './definition';
import { DefinitionFile } from './interfaces';
import { strings } from './strings';
import { Toolset } from './toolset';


function isRx(text:string){
  return text.includes('*') || text.includes('?') || text.includes('+');
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

function nativePath(path:string){
  return resolve(path);
}

function createResolver(definition: DefinitionFile, compilerPath: string) {
  return (prefix:string, expression: string) => {
    switch (prefix) {
      case 'env':
        // make sure ${env:HOME} is expanded to the user's home directory always
        if (expression.toLowerCase() === 'home') {
          return homedir();
        }
        return process.env[expression] || '';

      case 'definition':
        return (definition as any)[expression] || '';

      case 'config':
        // get a configuration variable from vscode
        // vscode.workspace.getConfiguration().get(expression.replace(/:/g,'.'));
        return '';

      case 'host':
        switch (expression){
          case 'os':
            return process.platform;
          case 'arch':
            return process.arch;
        }
        break;

      case 'compilerPath':
        switch (expression){
          case 'basename':
            return process.platform === 'win32' ? basename(compilerPath, '.exe'): basename(compilerPath);
        }
        break;

      case '':
        // todo: if they ask for a variable without a prefix, it could be a host variable -- ask vscode to resolve those
        switch (expression) {
          case 'workspaceroot':
          case 'workspaceRoot':
          case 'workspaceFolder':
          case 'workspacefolder':
          case 'cwd': // ??
            // get it from vscode (ie: vscode.workspace.workspaceFolders[0]?.uri.fsPath || '' );
            return process.cwd(); // fake, this should come from the host.

          case 'pathSeparator':
            return sep;

          case 'pathDelimiter':
            return delimiter;

          case 'name':
            return definition.name;

          case 'binary':
          case 'compilerPath':
            return compilerPath;
        }
        break;

      default:
        return '';
    }

    return '';
  };
};

/**
 * For all the paths, given the definition, if it passes muster, return a toolkit
 * @param paths all the binary paths that could match the defintion
 * @param definition the definition to test against
 */
async function *discover(paths: Array<string>, definition:DefinitionFile): AsyncIterable<Toolset> {
  definition = JSON.parse(JSON.stringify(definition)); // clone the definition so we can safely modify it

  next:
  for (let compilerPath of paths) {
    compilerPath = normalizePath(compilerPath); // normalize the path separators to be forward slashes.

    // here, we're going to handle each potential location
    const additionalProperties = {...definition.defaults?.additionalProperties } as Record<string,any>;

    // resolver for variables in the definition
    const resolver = createResolver(definition, compilerPath);

    // for each result, check if they specified any requirements
    if (definition.discover.requirements) {
      for (const [variable, op] of Object.entries(definition.discover.requirements)) {
        const [operation,rawValue] = Object.entries(op)[0];
        const value = render(rawValue,additionalProperties,resolver);
        switch (operation) {
          case 'regex': {// regex matches a value in the path to the ${binary}.
            // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
            const rx =new RegExp(value,'i');
            const rxResult = await scanForString(compilerPath,rx);
            if (!rxResult){
              // missing requirement
              continue next;
            }
            additionalProperties[variable]=rxResult;
          }
            break;
          case 'match': {// match/get matches a value in the path to the ${binary}.
            // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
            const rx =new RegExp(value,'i');
            const rxResult = rx.exec(compilerPath);
            if (!rxResult) {
              // didn't match the value - if this is a 'match' then we're going to bail
              continue next;
            }

            // we did get a match, let's record that in a variable (first, a group match, then the whole match, or 'true')
            additionalProperties[variable]=rxResult[1]||rxResult[0]||true;
          }
            break;

          case 'folder': // folder verifies that a given folder exists
            const folder = await path.isFolder(value,compilerPath);
            if (!folder) {
              // missing requirement
              continue next;
            }
            // add this folder to the variables
            additionalProperties[variable] = normalizePath(folder);
            break;

          case 'file':
            const file = await path.isFile(value,compilerPath);
            if (!file) {
              // missing requirement
              continue next;
            }
            // add this file to the variables
            additionalProperties[variable] = normalizePath(file);
            break;
        }
      }
    }

    // add the toolset to the results
    yield new Toolset(nativePath(compilerPath), definition, resolver);
  }
}

/**
 * Scan for all compilers using the definitions (toolset.*.json) in the given folders
 *
 * @param configurationFolders The folders to scan for compiler definitions
 */
export async function* detectCompilers(configurationFolders:Array<string>) : AsyncIterable<Toolset> {
  yield *combine(...[...await loadCompilerDefinitions(configurationFolders)].map(each=> detectCompiler(each)));
}

/** Given a specific definition file, detect a compiler
 *
 * If a path to candidate is passed in then we will only check that path.
 *
 * Otherwise, it will scan the $PATH, $ProgramFiles* and locations specified in the definition file.
 */
export async function* detectCompiler(definition:DefinitionFile, candidate?:string) : AsyncIterable<Toolset> {

  // run the conditions once before we start.
  const resolver = createResolver(definition,'');
  runConditions(definition, resolver);

  // if we're just checking a single candidate, we don't need to do any finding
  if (candidate) {
    const info = await path.info(candidate);
    if (info?.isExecutable) {
      for await (const each of discover([candidate], definition)){
        yield each;
      }
    }
    return;
  }

  // first make a matcher for the filenames
  // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
  const filenameMatches = strings(definition.discover.binary).map(each => isRx(each) ? (basename: string) => basename.match(new RegExp(`^${each}$`)): (basename: string) => basename === each);

  // create the finder
  const finder = new Finder((f)=> f.isExecutable && filenameMatches.some(matcher => matcher(f.basename)));

  // start scanning the folders in the $PATH
  finder.scan(...await filterToFolders(pathsFromVariable('PATH')));

  // add any folders that the definition specifies (expand any variables)
  finder.scan(10,...strings(definition.discover.locations).map(each=> render(each,{},resolver)));

  // add any platform folders
  switch (process.platform) {
    case 'win32':
      for (const each of ['ProgramFiles','ProgramFiles(x86)','ProgramFiles(Arm)']) {
        const folder = process.env[each];
        if (folder) {
          finder.scan(10, folder);
        }
      }
      break;
    case 'linux':
      finder.scan(10, '/usr/lib/');
      break;

    case 'darwin':
      break;
  }

  const paths = await finder.results;

  // wait for the results.
  if (!paths.size) {
    // console.log(`Nothing found for ${definition.name}`);
    return;
  }

  // return all the things that we discover on those paths that matched.
  yield *discover([...paths], definition);

  //  for await (const each of discover([...paths], definition)) {
  //  yield each;
  //  }
}