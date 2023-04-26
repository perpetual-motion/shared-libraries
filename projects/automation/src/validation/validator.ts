// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.
import * as ts from 'ts-morph';

export interface ValidationMessage {
  line?: number,
  column?: number,
  category: ts.DiagnosticCategory;
  message: string;
}

export function createValidator(interfaceDeclarationsTypescriptSource:string, typeName:string) : (input:any)=> Array<ValidationMessage> {
  const project = new ts.Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
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

  const sourceFile = project.createSourceFile('interfaces.ts', interfaceDeclarationsTypescriptSource);

  return (input:any)=> {
    if (!input) {
      return [{
        category: ts.DiagnosticCategory.Error,
        message: 'input data is not an object',
      }];
    }
    let data = '';

    switch (typeof input) {
      case 'object':
        data = JSON.stringify(input,null,2);
        break;

      case 'string':
        data = input;
        break;

      default:
        return [{
          category: ts.DiagnosticCategory.Error,
          message: 'input data is not an object',
        }];
    }

    sourceFile.removeText();
    sourceFile.insertText(0, `const value:${typeName} = ${data};\n\n${interfaceDeclarationsTypescriptSource}`);
    return project.getPreEmitDiagnostics().filter(each => each.getCode() !== 2615).map(d => {
      const { line, column } = d.getSourceFile()?.getLineAndColumnAtPos(d.getStart()||0) || {line:1,column:1};

      let message = d.getMessageText();
      if (message instanceof ts.DiagnosticMessageChain) {
        message = message.getMessageText().toString();
      }

      return {
        line,
        column,
        message,
        category: d.getCategory()
      };
    });
  };
}