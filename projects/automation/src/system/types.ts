// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

/* eslint-disable @typescript-eslint/ban-types */
import { ConstructorReturn } from '../async/internals';

export type Primitive = string | number | boolean;

export type Constructor = new(...args:Array<any>)=>any;
export type AribtraryObject = Record<string, any>;
export type Initializer<T> = T | (() => Promise<T>) | (() => T) | (new ()=>T);

export type Instance<T> = Awaited<T>;
export interface AsyncConstructor<TClass extends new (...args: ConstructorParameters<TClass>) => ConstructorReturn<TClass>> {
  new(...args: ConstructorParameters<TClass>): Promise<ConstructorReturn<TClass>>;
  class: TClass;
}

export type DeepPartial<T> =
  T extends Primitive | Function | Date ? T :
  T extends Map<infer K, infer V> ? DeepPartialMap<K, V> :
  T extends Set<infer U> ? DeepPartialSet<U> :
  {
    [P in keyof T]?:
    T[P] extends Array<infer U> ? Array<DeepPartial<U>> :
    T[P] extends ReadonlyArray<infer V> ? ReadonlyArray<DeepPartial<V>> :
    T[P] extends Primitive ? T[P] :
    DeepPartial<T[P]>
  } | T;

export type NDeepPartial<T> =
  T extends Primitive ? T :
  T extends Function ? T :
  T extends Date ? T :
  T extends Map<infer TKey, infer TValue> ? DeepPartialMap<TKey, TValue> :
  T extends Set<infer TElement> ? DeepPartialSet<TElement> :
  T extends {} ? {
    [P in keyof T]?:
    // T[P] extends Array<infer U> ? Array<DeepPartial<U>> :        // if it is an array then use an Array of DeepPartial
    // T[P] extends ReadonlyArray<infer V> ? ReadonlyArray<DeepPartial<V>> :   // if it's an ReadOnly Array, // use a ReadOnly of DeepPartial
    T[P] extends string | number | boolean | null | undefined ? T[P] :      // if it's a primitive use that
    NDeepPartial<T[P]>                                                       // otherwise, it's a DeepPartial of the type.
  } :
  Partial<T>;


interface DeepPartialSet<TItem> extends Set<NDeepPartial<TItem>> { }
interface DeepPartialMap<TKey, TValue> extends Map<NDeepPartial<TKey>, NDeepPartial<TValue>> { }