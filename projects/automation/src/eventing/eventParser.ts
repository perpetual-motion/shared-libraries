// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { hasErrors } from '../sandbox/interfaces';
import { Sandbox } from '../sandbox/sandbox';
import { first } from '../system/array';
import { smash } from '../text/identifiers';
import { Kind, Scanner, Token } from '../text/scanner';
import { internal } from './channels';

import { ArbitraryObject, Filter } from './interfaces';

// ensure that array gets the first function, we need it for the discriminator
// eslint-disable-next-line no-unused-expressions
first;

function isKeyword(token: Token) {
  return token.kind > Kind.KeywordsStart && token.kind < Kind.KeywordsEnd;
}

export function parse(triggerExpression: string, sourceToBindTo: ArbitraryObject|undefined) : [boolean, boolean, Map<string,Filter|true>, ArbitraryObject?] {
  //
  // [modifiers] event[filter]:discriminator[filter]/discriminator[filter]/discriminator[filter]...
  //

  const scanner = new Scanner(triggerExpression).start();
  let token: Token;

  let once: boolean =false;
  let source:any = undefined;
  let isSync = false;
  // const name= '';

  // drop any leading whitespace
  scanner.takeWhiteSpaceAndNewLines();

  // grab modifiers off the front
  while (isKeyword(token = scanner.take())) {
    switch (token.kind) {
      case Kind.OnceKeyword:
        once = true;
        break;
      case Kind.ThisKeyword:
        source = sourceToBindTo;
        break;
      case Kind.AwaitKeyword:
        isSync = true;
        break;
      default:
        throw new Error(`unexpected keyword ${token.kind}`);
    }
    scanner.takeWhiteSpaceAndNewLines();
  }

  const filters = new Map<string, Filter|true>(); // <name, filterFn>

  function addFilter(name: string) {
    scanner.takeWhiteSpaceAndNewLines();
    token = scanner.take();
    if (token.kind === Kind.OpenBracket) {
      // has a filter expression of some kind.
      filters.set(name, generateFilterFn(scanner));
      token = scanner.take();
    } else {
      // if there isn't a filter, then we just need to add a filter with 'true'
      filters.set(name, true);
    }
    scanner.takeWhiteSpaceAndNewLines();
    return token.kind === Kind.EndOfFile;
  }

  processing:
  do {
    switch (token.kind){
      case Kind.EndOfFile:
        break processing;

      case Kind.Slash:
        // separator - skip this token (we can skip over multiple slashes, it's ok...)
        token = scanner.take();
        continue;

      case Kind.Asterisk:
        // match any event name
        if (addFilter('*')) {
          break processing;
        }
        break;

      case Kind.Identifier:
        if (addFilter(smash(token.text))) {
          break processing;
        }
        break;

      case Kind.OpenBracket:
        // filter without event or discriminator name
        filters.set('*', generateFilterFn(scanner));
        token = scanner.take();
        break;

      case Kind.Whitespace:
        continue processing;

      default:
        throw new Error(`unexpected token ${JSON.stringify(token)}`);
    }

    if (token.kind === Kind.EndOfFile) {
      break;
    }

    // if the token isn't a separator or end of file, then it is an error
    if (token.kind !== Kind.Slash) {
      throw new Error(`unexpected token ${JSON.stringify(token)}`);
    }
  } while (true);


  // for each discriminator[filter]
  // get the descriptor name
  // get the filter value
  // the filter expression is a javascript expression. (special case: if a regex is a part of the expression, it's assumed to be applied against the text of the event data )
  // [/foo/g]
  if (sourceToBindTo !== source) {
    internal(`source specified but 'this' not found in handler name or expression for '${triggerExpression}' `);
  }
  return [isSync, once, filters, source];

}

const sandbox = new Sandbox();

function generateFilterFn(scanner: Scanner): Filter {
  // take all the tokens until we hit a closing bracket
  const inner = [...scanner.takeUntil(Kind.CloseBracket, {
    nestable: [[Kind.OpenBracket, Kind.CloseBracket]],
    escape: [Kind.Backslash]
  })];

  // a filter expression is one or more of:
  //  - a regular expression
  //  - a javascript expression
  // separated by && or ||
  const expression = new Array<string>();

  // remove leading whitespace
  eatWhitespace(inner);

  outer:
  while (inner.length) {
    eatWhitespace(inner);
    let token = inner.shift()!;

    switch (token.kind) {
      case Kind.Slash: {
        // regular expression
        // take all tokens until we hit a slash that isn't escaped
        const rxExpression = [token];


        while (inner.length) {

          token = inner.shift()!;
          rxExpression.push(token);  // store this token as part of the regex

          switch (token.kind) {
            case Kind.Slash:
              // now see if there are any flags
              // eatWhitespace(inner);

              if (inner.length) {
                token = inner[0];
                if (token.kind === Kind.Identifier) {
                  rxExpression.push(inner.shift()!);
                }
              }
              // at this point, we should have the whole regex.
              // turn this into an expression that tests against any $strings
              expression.push(`(!!$strings.first( ($text)=> { const r = ${rxExpression.map(token => token.text).join('')}.exec($text); if( r ) { $captures.push( ...r ); return true; } } ))`);
              continue outer;

            case Kind.Backslash:
              // take the next token, and add it to the regex
              rxExpression.push(inner.shift()!);
              continue;
          }
          // eatWhitespace(inner);

          // if we have nothing left, and we haven't closed the regex, then it's an error
          if (!inner.length) {
            throw new Error(`unterminated regular expression ${inner}`);
          }
        }
      }
        break;

      case Kind.OpenParen:
      case Kind.CloseParen:
      case Kind.BarBar:
      case Kind.AmpersandAmpersand:
      // add that token to the final expression
        expression.push(token.text!);
        break;

      case Kind.StringLiteral:
        // if we're given a string literal and the next token after that is one of {||, &&, ],}
        // then we can just use the string literal as a comparison
        // otherwise it should be part of the javascript expression (ie, ['foo'===bar])
        eatWhitespace(inner);
        const peek = inner[0];
        if (peek) {
          switch (peek.kind) {
            case Kind.BarBar:
            case Kind.AmpersandAmpersand:
            case Kind.CloseBracket:
              expression.push(`$strings.has(${token.text!})`);
              continue outer;
          }
        }

      // eslint-disable-next-line no-fallthrough
      default:
      // anything else, take all the tokens until we hit a separator/terminator/the end
        const js = [token];
        while (inner.length) {
          token = inner.shift()!;
          switch (token.kind) {
            case Kind.BarBar:
            case Kind.AmpersandAmpersand:
            case Kind.CloseBracket:
            // push the token back on the stack, and we're done
              inner.unshift(token);
              break;
            default:
              js.push(token);
              continue;
          }
          break;
        }
        const jsExpression = js.map(each=> each.text).join('');

        // sandbox style, assumes $data is set to Event.data and $strings is the collection of strings for the discriminator or the event itself
        expression.push(jsExpression.trim());
        break;
    }
  }

  // $data -- either the event data or the event source object if there is no event data.
  // $strings - an set of string values to match a regex with. )

  // for creating the filter functions, we're not invoking the transpiler,
  // since these will be simple expressions that are generated by the parser.
  // and don't need the full power of the transpiler. (and it's MUCH faster)
  const fn = sandbox.createFunction<Filter>(`try { with($data) return ${expression.join(' ')} } catch ($e) { return false; }`,['$data', '$strings','$captures'], { transpile: false });

  if (hasErrors(fn)) {
    throw new Error(`invalid filter expression: ${expression.join(' ')}`);
  }

  return fn;
}

function eatWhitespace(tokens: Array<Token>) {
  while (tokens.length && tokens[0].kind === Kind.Whitespace) {
    tokens.shift();
  }
}