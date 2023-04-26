// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { safeEval } from '../sandbox/sandbox';
import { isIdentifierPart, isIdentifierStart } from './character-codes';

export function taggedLiteral(templateString:string, templateVars:Record<string,any>) : string {
  return safeEval(`\`${templateString.replace('\\','\\\\').replace(/`/,'\`')}\`;`, templateVars) as string;
}

export function parseTaggedLiteral(templateString: string) {
  // must parse the inside of javascript tagged literal format
  // and ensure that escape sequences like \n \t \r \$ are handled correctly
  const result = {
    template: new Array<string>(),
    expressions: new Array<string>(),
    state: 'text' as 'text'|'escape'|'dollar'|'substitution'|'error'|'ok',
    message: ''
  };

  let template = '';
  let expression = '';

  for (const char of templateString) {
    switch (result.state) {
      case 'text':
        switch (char) {
          case '\\':
            result.state = 'escape';
            continue;
          case '$':
            result.state = 'dollar';
            continue;
        }
        template+=char;
        continue;

      case 'escape':
        template = `${template}\\${char}`;
        result.state = 'text';
        continue;

      case 'dollar':
        if (char === '{') {
          result.state = 'substitution';
          result.template.push(template);
          template = '';
          continue;
        }
        template = `${template}$${char}`;
        result.state = 'text';
        continue;

      case 'substitution':
        switch (char) {
          case '}':
            result.expressions.push(expression);
            expression = '';
            result.state = 'text';
            continue;

          case ' ':
          case '\t':
          case '\r':
          case '\n':
            continue; // ignore whitespace

          case ':':
          case '.':
            expression += ':';
            continue;
        }
        if (expression) {
          if (isIdentifierPart(char.codePointAt(0)!)|| char === '-' || char === '/') {
            expression += char;
            continue;
          }
          // error, fall thru
        } else if (isIdentifierStart(char.codePointAt(0)!) || char === '-' || char === '/') {
          expression += char;
          continue;
        }

        // not a valid character for an expression
        result.state = 'error';
        result.message = `Unexpected character '${char}' in expression ${expression}`;
        return result;
    }
  }

  switch (result.state) {
    case 'escape':
      result.state = 'error';
      result.message = 'Unexpected end of string (trailing backslash)';
      return result;
    case 'substitution':
      result.state = 'error';
      result.message = 'Unexpected end of string parsing expression ${ ';
      return result;
    case 'dollar':
      template += '$';
      break;
  }
  result.state = 'ok';
  result.template.push(template);
  return result;
}

export function split(expression: string) {
  return (expression.match(/(.*?):(.*)/) || ['','',expression]).slice(1);
}

export function resolve(expression:string, variables: Record<string,any>,dynamic = (prefix:string, expression:string)=>''): string{
  const [prefix, suffix]= split(expression);

  if (prefix) {
    const variable = variables[prefix];
    if (variable !== undefined && variable !== null) {      // did we get back an actual value
      // its a child of a variable
      return suffix.includes(':') ?                         // is the suffix another expression?
        resolve(suffix, variable) :                         // Yeah, resolve it
        variable[suffix] ?? dynamic(prefix, suffix) ?? '';  // No, return the member of the variable, or dynamic, or empty string
    }

    // no variable by that name, so return the dynamic value, or an empty string
    return dynamic(prefix, suffix) ?? '';
  }
  // look up the value in the variables, or ask the dynamic function to resolve it, failing that, an empty string
  return variables[suffix] ?? dynamic(prefix, suffix) ?? '';
}

export function render(templateString: string, variables: Record<string,any>, dynamic = (prefix:string, expression:string)=>'', quoteValues = false): string {
  const { template, expressions, state, message } = parseTaggedLiteral(templateString);
  const q = quoteValues ? (x:string)=>`'${x}'` : (x:string)=>x;
  return state === 'error' ?
    message:  // return the error message if the parse failed. (this is fatal anyways)
    template.reduce((result, each, index) => `${result}${q(resolve(expressions[index-1], variables,dynamic))}${each}`); // resolve the inline expressions and join the template
}