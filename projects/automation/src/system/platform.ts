// Copyright (c) Perpetual-Motion project
// Licensed under the MIT License.


import { lazy } from '../async/lazy';
import { filterToFolders, pathsFromVariable } from '../filesystem/path';

export const searchPaths = lazy(()=>filterToFolders(pathsFromVariable('PATH')));