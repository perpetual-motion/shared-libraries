// You can add logs by using console.log
console.log('We ♡ JavaScript!');
const rx = require('C:\\work\\2023\\shared-libraries\\common\\temp\\node_modules\\.pnpm\\super-expressive@1.4.2\\node_modules\\super-expressive');
const d = rx().char('d');

// hack rx to add some shortcuts
const p = Object.getPrototypeOf(rx());
p.$ = p.subexpression;

const dashOrSlash = rx().anyOf.char('-').char('/').end();
const key = rx().namedCapture('key').oneOrMore.anythingButChars('=').end();
const value = rx().namedCapture('value').oneOrMore.anyChar.end();
const keyEqualsValue = rx().$(key).char('=').$(value);

const define = rx().caseInsensitive.startOfInput.
  $(dashOrSlash).
  d.
  $(keyEqualsValue).
  endOfInput.
  toRegex();

const define2 = rx().caseInsensitive.startOfInput.
  $(dashOrSlash).
  d.
  $(key).
  endOfInput.
  toRegex();


console.log(define.exec('-Dfoo=bar').groups);
console.log(define.exec('-dfoo=bar').groups)
console.log(define.exec('/Dfoo=bar').groups)
console.log(define.exec('/dfoo=bar').groups)
console.log(define2.exec('-dfoo').groups)

const rxes = {
  define,
  define2
}
console.log(rxes);