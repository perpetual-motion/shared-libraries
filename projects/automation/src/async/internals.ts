// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.

/** @internal */
export type Resolve<T> = (value: T | PromiseLike<T>) => void;

/** @internal */
export type Reject = (reason?: any) => void;

/** @internal */
export type ConstructorReturn<T extends abstract new (...args: any) => any> = T extends abstract new (...args: any) => infer R ? R : never
