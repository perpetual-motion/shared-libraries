// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.


import * as ts from 'ts-morph';
import { start } from '../eventing/channels';
import { hasErrors, ScriptError } from './interfaces';


function getErrors(project: ts.Project, ignoreCodes: Array<number>) : Array<ScriptError> {

  const errors = project.getPreEmitDiagnostics().filter(d => !ignoreCodes.includes(d.getCode()));

  return errors.map(d => {
    const { line, column } = d.getSourceFile()?.getLineAndColumnAtPos(d.getStart()||0) || {line:1,column:1};

    let message = d.getMessageText();
    if (message instanceof ts.DiagnosticMessageChain) {
      message = message.getMessageText().toString();
    }

    return {
      line,
      column,
      message,
      file: d.getSourceFile()?.getFilePath() || 'unknown file',
      category: d.getCategory(),
      code: d.getCode(),
      offset: d.getStart()||0
    };
  });
}

function createProject(sourceCode: string, filename: string, ignoreCodes: Array<number> = [], compilerOptions?: ts.ts.CompilerOptions) :Array<ScriptError>|ts.Project {
  const t = start();
  const project = new ts.Project({
    useInMemoryFileSystem: true,
    compilerOptions: {

      // these can be overridden by the caller
      isolatedModules: true,

      // add overrides
      ... compilerOptions|| {},

      // these are always set
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.CommonJS,
      lib: ['lib.esnext.full.d.ts'],

      noResolve: true,
      inlineSourceMap: true,
      declarationMap: false,
      sourceMap: false,
      skipDefaultLibCheck: true,
      skipLibCheck: true,
      allowJs: true,
      checkJs: false,
      outDir: 'dist',
    }
  });

  project.createSourceFile(filename, sourceCode);

  // get any errors that would prevent the code from running
  const errors = getErrors(project, ignoreCodes);

  if (errors.length) {
    return errors;
  }

  return project;
}

async function transpile(args: {sourceCode: string,filename: string, ignoreCodes: Array<number>, options?: ts.ts.CompilerOptions & { rawFunction?: boolean  }}):Promise<string| Array<ScriptError>> {
  // eslint-disable-next-line prefer-const
  let { sourceCode, filename, ignoreCodes, options } = args;
  options = {
    ...options || {},
    isolatedModules: options?.rawFunction ? false : true,
  };

  let result = createProject(sourceCode, filename, ignoreCodes, options);
  // if we get any 1108 errors, we need to temporarily remove the return statements and try again
  if (options.rawFunction &&  hasErrors(result)) {
    const errors = result.filter(e => e.code === 1108);
    if (errors.length) {
      // if we do have any 1108 errors, we need to remove the return statements and try again
      for (const error of errors) {
        // swap out the return statement for a magic string: "/*\R/*/"
        sourceCode = sourceCode.substring(0,error.offset) + '/*\\R/*/' + sourceCode.substring(error.offset+6);
      }

      result = createProject(sourceCode, filename,ignoreCodes, options);
    }
  }

  // if we have errors, return them instead.
  if (hasErrors(result)) {
    return result;
  }

  // return the transpiled code to the caller.
  return result.emitToMemory().getFiles()[0].text;
}

export default transpile;