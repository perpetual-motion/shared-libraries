// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { readFileSync } from 'fs';
import * as vm from 'vm';

/**
 * Creates a reusable safe-eval sandbox to execute code in.
 */
export function createSandbox(): <T>(code: string, context?: any) => T {
  const sandbox = vm.createContext({});
  return (code: string, context?: any) => {
    const response = 'SAFE_EVAL_' + Math.floor(Math.random() * 1000000);
    sandbox[response] = {};
    if (context) {
      Object.keys(context).forEach((key) => (sandbox[key] = context[key]));
      vm.runInContext(
        `try {  ${response} = ${code} } catch (e) { ${response} = undefined }`,
        sandbox
      );
      for (const key of Object.keys(context)) {
        delete sandbox[key];
      }
    } else {
      vm.runInContext(`${response} = ${code}`, sandbox);
    }
    return sandbox[response];
  };
}

export const safeEval = createSandbox();

function loadJson(path: string) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

const languages = {
  none: loadJson('../locales/messages.json'),
  cs: loadJson('../locales/messages.cs.json'),
  de: loadJson('../locales/messages.de.json'),
  en: loadJson('../locales/messages.en.json'),
  es: loadJson('../locales/messages.es.json'),
  fr: loadJson('../locales/messages.fr.json'),
  it: loadJson('../locales/messages.it.json'),
  ja: loadJson('../locales/messages.ja.json'),
  ko: loadJson('../locales/messages.ko.json'),
  pl: loadJson('../locales/messages.pl.json'),
  'pt-BR': loadJson('../locales/messages.pt-BR.json'),
  ru: loadJson('../locales/messages.ru.json'),
  tr: loadJson('../locales/messages.tr.json'),
  'zh-Hans': loadJson('../locales/messages.zh-Hans.json'),
  'zh-Hant': loadJson('../locales/messages.zh-Hant.json'),
};

type PrimitiveValue = string | number | boolean | undefined | Date;
let currentLocale = languages.none;

export function setLocale(newLocale: string) {
  currentLocale = (languages as Record<string, any>)[newLocale];
  if (currentLocale) {
    return;
  }

  const l = newLocale.lastIndexOf('-');
  if (l > -1) {
    const localeFiltered = newLocale.substr(0, l);
    currentLocale = (languages as Record<string, any>)[localeFiltered];
    if (currentLocale) {
      return;
    }
  }

  // fall back to none
  currentLocale = languages.none;
}

/**
 * generates the translation key for a given message
 *
 * @param literals
 * @returns the key
 */
function indexOf(literals: TemplateStringsArray) {
  const content = literals.flatMap((k, i) => [k, '$']);
  content.length--; // drop the trailing undefined.
  return content
    .join('')
    .trim()
    .replace(/ [a-z]/g, ([a, b]) => b.toUpperCase())
    .replace(/[^a-zA-Z$]/g, '');
}

/**
 * Support for tagged template literals for i18n.
 *
 * Leverages translation files in ../i18n
 *
 * @param literals the literal values in the tagged template
 * @param values the inserted values in the template
 *
 * @translator
 */
export function i(
  literals: TemplateStringsArray,
  ...values: Array<string | number | boolean | undefined | Date>
): string {
  const key = indexOf(literals);
  if (key) {
    const str = currentLocale[key];
    if (str) {
      // fill out the template string.
      return safeEval(
        `\`${str}\``,
        values.reduce((p, c, i) => {
          p[`p${i}`] = c;
          return p;
        },{} as any)
      );
    }
  }

  // if the translation isn't available, just resolve the string template normally.
  return String.raw(literals, ...values);
}
