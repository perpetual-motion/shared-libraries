// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.


function ansi(literals: TemplateStringsArray, ...values: Array<string | number | boolean | undefined | Date>) {
  return `\u001b${String.raw(literals, ...values)}`;
}

function csi(literals: TemplateStringsArray, ...values: Array<string | number | boolean | undefined | Date>) {
  return ansi`[${String.raw(literals, ...values)}`;
}

function cup(x: number, y: number) {
  return csi`${y};${x}H`;
}

function ed() {
  return csi`2J`;
}

function sgr(...values: Array<number>) {
  return csi`${values.join(';')}m`;
}

function reset() {
  return sgr(0);
}

function bold() {
  return sgr(1);
}

function dim() {
  return sgr(2);
}


function fg256(foreground: number) {
  return sgr(38, 5, foreground);
}

function bg256(background: number) {
  return sgr(48, 5, background);
}

function fgRGB(r: number, g: number, b: number) {
  return sgr(38, 2, r, g, b);
}
function bgRGB(r: number, g: number, b: number) {
  return sgr(48, 2, r, g, b);
}

function underline() {
  return sgr(4);
}

function blink() {
  return sgr(5);
}

function red(literals: TemplateStringsArray, ...values: Array<string | number | boolean | undefined | Date>) {
  return fgRGB(197,15,31) + String.raw(literals, ...values) + reset();
}

function green(literals: TemplateStringsArray, ...values: Array<string | number | boolean | undefined | Date>) {
  return fgRGB(19,161,14) + String.raw(literals, ...values) + reset();
}

// console.log(red`this is a test ${100} ${green`${200}`}`);

function factory(...parts: Array<string>) {
  return function(literals: TemplateStringsArray, ...values: Array<string | number | boolean | undefined | Date>) {
    return parts.join('') + String.raw(literals, ...values) + reset();
  };
}

export const fns = {
  fg: {
    black: factory(fgRGB(0,0,0)),
  },
  bg: {
    black: sgr(40),
  }
};

// fns.fg.black`hello world`;

// fg.blue`foo`+red`bar`+green`baz`