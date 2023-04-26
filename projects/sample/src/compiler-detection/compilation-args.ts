/* eslint-disable header/header */
/* eslint-disable @typescript-eslint/naming-convention */

import { CppStandard, CStandard } from './interfaces';

// -----------------------------------------------------------------------------------------------
// The following are used to create the compilation_args struct that are a per-file struct that is
// passed to the back-end to instruct EDG to handle the file.
// These will be created with the Toolset + [user configuration] + [compiler_commands] + analysis
// -----------------------------------------------------------------------------------------------

/** @internal Replicates the struct on the native side. */
export interface IncludePath {
  path: string;
  is_system: boolean;   // defaults to false
}

/** @internal Replicates the struct on the native side. */
export interface CompileCommandsEntry {
  directory: string;
  command: string;
  file: string;
  output: string;
  arguments: Array<string>;
}

/** @internal Replicates the struct on the native side. */
export interface CompilationArgs {
    is_c: boolean;      // defaults to false
    is_cuda: boolean;   // defaults to false

    std_version: CppStandard | CStandard;
    includes: Array<IncludePath>;
    after_system_includes: Array<IncludePath>;
    frameworks: Array<IncludePath>;
    original_defines: Array<string>;
    defines: Array<string>;
    forced_include: Array<IncludePath>;
    other: Array<string>; // what is this for ???
    IntelliSenseMode: string; // will have to be parsed on the C++ side during deserialization to be an enum
    compiler_path: string;

    // All the include paths before they're filtered by the tag parser results.
    original_includes: Array<IncludePath>;
    compile_commands_entry: CompileCommandsEntry;
};