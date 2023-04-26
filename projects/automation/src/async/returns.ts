// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

/** constant functions that return constant values (useful for 'catch') */
export const returns = {
  /** returns undefined */
  undefined: ()=>undefined,

  /** returns an empty array */
  none: ()=>[],

  /** returns null */
  null: ()=>null,

  /** returns false */
  false: ()=>false,

  /** returns true */
  true: ()=>true,

  /** returns zero */
  zero: ()=>0,

  /** returns an empty string */
  empty: ()=>'',
};