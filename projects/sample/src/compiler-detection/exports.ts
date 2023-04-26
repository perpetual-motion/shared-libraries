/* eslint-disable header/header */

/*
import { CompilationArgs, Toolset } from './interfaces';

// ideally this should be called early on during activation so that we have the compilers ready to use when we need to reference them
// ideally this is cached both in-memory and on-disk so that we don't have to do this every time we activate
// although, it may make sense to discover anyway, just in case something has changed (but not block on that)
export async function discoverCompilers(...definitionFileFolders:Array<string>): Promise<Array<Toolset>> { throw new Error('Not implemented'); }

// Given a path or name, we'll run discovery on that path and return the compiler that it matches. (If it doesn't match, we'll return a very generic toolset?)
// this should get run when the configuration changes (either from c_cpp_properties.json or from a configuration provider)
// this will be nearly a NOP if the compiler is already discovered
export async function discoverCompiler(pathOrName: string, ...definitionFileFolders:Array<string>): Promise<Toolset|undefined> { throw new Error('Not implemented'); }

// Kicks off the query for a compiler and caches the result (in memory) so that it's only done once per activation.
// this will be nearly a NOP if the toolset is already query
// "ToolsetQueried"
export async function query(toolset: Toolset): Promise<void> { throw new Error('Not implemented'); }

// given a toolset and a file path, we'll create the compilation args that are needed to pass to the back-end
// this will likely have to called for each file that is being opened.
// This version of the call doesn't actively query the compiler, but does everything it can with the generic toolset information that was queried earlier.
// nb: Colen referred to this as "Processed"
export async function createCompilationArgsLight(toolset: Toolset, file: string): Promise<CompilationArgs> { throw new Error('Not implemented'); }

// This is similar to the above, but it would also actively query the compiler with all the args that are given as to get the most accurate information.
// nb: Colen referred to this as "Queried"
export async function createCompilationArgsDeep(toolset: Toolset, file: string): Promise<CompilationArgs> { throw new Error('Not implemented'); }


*/