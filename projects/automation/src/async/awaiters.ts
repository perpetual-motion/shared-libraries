// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

import { is } from '../system/guards';

/** an async foreach function to iterate over any iterable/async iterable, calling a function on each item in parallel as possible */
export async function foreach<T,TResult>(items: undefined|Iterable<T>|Promise<Iterable<T>|undefined>|Promise<undefined>|AsyncIterable<T>|Promise<AsyncIterable<T>>, callbackfn: (item: T) => Promise<TResult>) : Promise<Array<TResult>> {
  items = is.promise(items) ? await items : items;                      // unwrap the promise if it is one

  if (items) {
    const result = [];
    if (is.asyncIterable(items)) {
      for await (const item of items) {
        result.push(callbackfn(item));                                            // run the predicate on each item
      }
    } else {
      for (const item of items) {
        result.push(callbackfn(item));                                            // run the predicate on each item
      }
    }
    return Promise.all(result);
  }
  return [];                                                 // return an empty array if there is nothing to iterate over
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

/** Takes multiple AsyncIterable<T> objects and combines it into a single one that can be used with for-await without blocking */
async function* combine_old<T>(...iterables:Array<AsyncIterable<T>>) {
  // Queue up the first item from each iterator
  async function awaitNext(element: Cursor<T>): Promise<Cursor<T>> {
    element.result = undefined; // drop the previous result before awaiting the next
    element.result = await element.iterator.next();
    return element;
  };

  // Create a map of the iterators, and queue up the first
  const iterators = new Map(iterables.map((iterable,index) => [ index, awaitNext({ identity: index, iterator: iterable[Symbol.asyncIterator]() }) ]));

  // Loop until all iterators are done, removing them as they complete
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
    yield value;
  }
};

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

export function combine<T>(...iterables:Array<AsyncIterable<T>>) : AsyncIterable<T> & { add: (iterable: AsyncIterable<T>) => void } {
  const iterators = new Map<number, Promise<Cursor<T>>>();
  let result: AsyncIterable<T> & { add: (iterable: AsyncIterable<T>) => void };

  async function awaitNext(element: Cursor<T>): Promise<Cursor<T>> {
    element.result = undefined; // drop the previous result before awaiting the next
    element.result = await element.iterator.next();
    return element;
  };

  async function* combiner(...iterables:Array<AsyncIterable<T>>) {
    iterables.map((iterable,index) => iterators.set(index, awaitNext({ identity: index, iterator: iterable[Symbol.asyncIterator]() })));

    // Loop until all iterators are done, removing them as they complete
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

      yield value;
    }

    // prevent any more iterators from being added
    result.add = () => { throw new Error('AsyncIterable is finished'); };
  };

  result = combiner(...iterables) as unknown as AsyncIterable<T> & { add: (iterable: AsyncIterable<T>) => void };
  result.add = (iterable: AsyncIterable<T>) => iterators.set(iterators.size+1, awaitNext({ identity: iterators.size+1, iterator: iterable[Symbol.asyncIterator]() }));
  return result;
}
