// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { is } from '../system/guards';
import { Signal } from './signal';

/** an async foreach function to iterate over any iterable/async iterable, calling a function on each item in parallel as possible */
export async function foreach<T,TResult>(items: undefined|Iterable<T>|Promise<Iterable<T>|undefined>|Promise<undefined>|AsyncIterable<T>|Promise<AsyncIterable<T>>, predicate: (item: T) => Promise<TResult>) : Promise<Array<TResult>> {
  items = is.promise(items) ? await items : items;                      // unwrap the promise if it is one

  if (items) {
    const result = [];
    if (is.asyncIterable(items)) {
      for await (const item of items) {
        result.push(predicate(item));                                            // run the predicate on each item
      }
    } else {
      for (const item of items) {
        result.push(predicate(item));                                            // run the predicate on each item
      }
    }
    return Promise.all(result);
  }
  return [];                                                 // return an empty array if there is nothing to iterate over
}

export async function* forEachAsync<T,TResult>(items: undefined|Iterable<T>|Promise<Iterable<T>|undefined>|Promise<undefined>|AsyncIterable<T>|Promise<AsyncIterable<T>>, predicate: (item: T) => Promise<TResult>) : AsyncIterable<TResult> {
  items = is.promise(items) ? await items : items;                      // unwrap the promise if it is one

  if (items) {
    if (is.asyncIterable(items)) {
      for await (const item of items) {
        yield predicate(item);                                            // run the predicate on each item
      }
    } else {
      for (const item of items) {
        yield predicate(item);                                            // run the predicate on each item
      }
    }
  }
}

/** convenience function to do Promise.all on multiple items, and supports Iterable */
export function all<T>(...items: Array<Promise<T>|Iterable<Promise<T>>>) : Promise<Array<T>> {
  const result = [];
  for (const item of items) {
    if (is.promise(item)) {
      result.push(item);
    } else {
      for (const subItem of item) {
        result.push(subItem);
      }
    }
  }
  return Promise.all(result);
}


interface Cursor<T> {
  identity: number,
  iterator: AsyncIterator<T>,
  result?:IteratorResult<T, any>
}

/** An AsyncIterable wrapper that caches so that it can be iterated multiple times */
export function reiterable<T>(iterable: AsyncIterable<T>): AsyncIterable<T> {
  const cache = new Array<T>();
  let done: boolean|undefined = undefined;
  let nextElement: undefined|Promise<IteratorResult<T>> = undefined;

  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < cache.length) {
            return { value: cache[index++], done: false };
          }
          if (done) {
            return { value: undefined, done: true };
          }
          index++;
          if (!nextElement){
            nextElement = iterable[Symbol.asyncIterator]().next().then(element => {
              if (!(done = element.done)) {
                cache.push(element.value);
              }
              nextElement = undefined;
              return element;
            });
          }
          return nextElement;
        }
      };
    }
  };
}

export type AsynchIterable<T> = AsyncIterable<T> & { add: (...iterables: Array<Some<T>|undefined|Promise<T>|Promise<undefined|T>>) => void, complete: () => void, autoComplete: (shouldAutocomplete: boolean) => AsynchIterable<T>, reiterable : () => AsyncIterable<T>};

export function accumulator<T>(...iterables:Array<Some<T>>) : AsynchIterable<T>  {

  const iterators = new Map<number, Promise<Cursor<T>>>();
  //let result: AsyncIterableX<T>;
  let completeWhenEmpty =iterables.length > 0;   // if we are given any items, they we auto-complete when we run out (so an add after the last item is yielded will throw)
  const signal = new Signal<boolean>();

  const result = combiner(iterables) as unknown as AsynchIterable<T>;
  //result.add = (iterable: Some<T>) => signal.resolve(iterators.set(iterators.size+1, awaitNext({ identity: iterators.size+1, iterator: (is.asyncIterable(iterable) ? iterable as AsyncIterable<T>: asyncOf(iterable))[Symbol.asyncIterator]() })));
  result.add = (...iterables: Array<Some<T>|undefined|Promise<undefined|T>>) => {
    for (const iterable of iterables) {
      iterators.set(iterators.size+1, awaitNext({ identity: iterators.size+1, iterator: asyncOf(iterable)[Symbol.asyncIterator]() }));
    };
    signal.resolve(true);
  };

  result.autoComplete = (shouldAutocomplete: boolean) => { completeWhenEmpty = shouldAutocomplete ; return result;};
  result.complete = ()=>signal.resolve(completeWhenEmpty = true);
  result.reiterable = () => reiterable(result);

  return result;

  async function awaitNext(element: Cursor<T>): Promise<Cursor<T>> {
    element.result = undefined; // drop the previous result before awaiting the next
    element.result = await element.iterator.next();
    return element;
  };

  async function* combiner(iterables:Array<Some<T>>) {
    iterables.forEach((iterable,index) =>  iterators.set(index, awaitNext({ identity: index, iterator: asyncOf(iterable)[Symbol.asyncIterator]() })));

    // Loop until all iterators are done, removing them as they complete
    do  {
      if (!iterators.size) {
        await signal; // wait for a new item to be added, or for the complete signal
      }
      while (iterators.size) {
        const element = await Promise.race(iterators.values());
        // Is that iterator done?
        if (element.result!.done) {
          iterators.delete(element.identity);
          continue;
        }

        // Yield the result from the iterator, and await the next item
        const {value} =  element.result!;
        iterators.set(element.identity, awaitNext(element));
        if (value !== undefined && value !== null) {
          yield value;
        }
      }
      // eslint-disable-next-line no-unmodified-loop-condition
    } while (!completeWhenEmpty);
    // prevent any more iterators from being added
    result.add = () => { throw new Error('AsyncIterable is finished'); };
  };
}
export type Some<T> = T|Promise<T>|AsyncIterable<T|undefined>|AsyncIterable<Promise<T>|Promise<undefined>>|Iterable<T>|Iterable<Promise<T>>;

export function isSome<T>(item: Some<T>): item is Some<T> {
  return item !== undefined;
}

export async function* asyncOf<T>(...items: Array<undefined|Promise<undefined>|Some<T>>): AsyncIterable<NonNullable<T>> {
  for (const item of items) {
    // skip undefined
    if (item) {
      if (is.asyncIterable(item) || is.iterable(item)) {
        yield *item as any;
        continue;
      }
      yield item as any;
    }
  }
}
