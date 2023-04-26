/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable header/header */
/* eslint-disable @typescript-eslint/ban-types */

// Deep Partial implementation
export type Primitive = string | number | boolean | bigint | symbol | undefined | null | Date | Function | RegExp;
export type DeepPartial<T> =
  T extends Primitive | Function | Date ? T :
  {
    [P in keyof T]?:
    T[P] extends Array<infer U> ? Array<DeepPartial<U>> :
    T[P] extends ReadonlyArray<infer V> ? ReadonlyArray<DeepPartial<V>> :
    T[P] extends Primitive ? T[P] :
    DeepPartial<T[P]>
  } | T;

/** An Expression supports tempate variable substitution (ie `the workspace is $ {workspaceFolder}, the PATH is $ {env:PATH} `) */
export type Expression = string;

/** A Conditional is an Expression that is used to conditially apply configuation based on a specific condition being met */
export type Conditional = Expression ;

/** One or more (as a type or an array of a type) */
export type OneOrMore<T> = T | Array<T>;

/** A regular expression in a string
 *
 * take care that the string is properly escaped (ie, backslashes)
 */
export type RegularExpression = string;

/** Discovery requirements operations */
export type Operation = 'match' | 'folder'  | 'file' | 'regex';

/** officially supported standards (c++) */
export type CppStandard = 'c++98' | 'c++03' | 'c++11' | 'c++14' | 'c++17' | 'c++20' | 'c++23';

/** officially supported standards (c) */
export type CStandard = 'c89' | 'c99' | 'c11' | 'c17' | 'c23';

/** Package manager names */
export type PkgMgr = 'apt' | 'brew' | 'winget' | 'yum' | 'rpm' | 'dpkg';

/** A package definition */
export type Package = Partial<Record<PkgMgr, OneOrMore<string>>>;

/** A query definition - the 'active' requirements to get settings from a binary */
export type Query = Record<Expression, Record<string, OneOrMore<Expression>>>;

/** the target 'platform' (aka OS) */
export type Platform =
  'windows'|  // windows
  'linux'| // linux
  'macos'| // apple osx/darwin
  'ios'| // apple ios
  'none'| // bare metal
  'android'| // android
  'wasm'| // wasm
  'unknown'; // don't know what it is

/** The Target CPU/Processor architecture */
export type Architecture =
  'arm'| // arm aka aarch32
  'arm64'| // 64bit arm, aka aarch64
  'avr' | // AVR (arduino)
  'x64'| // x86_64 aka amd64 aka x64
  'x86'| // x86 (32bit)
  'riscv'| // riscv
  'ia64'| // ia64
  'mips'| // mips
  'ppc'| // ppc
  'sparc'| // sparc
  'wasm'| // wasm
  'unknown'; // don't know what it is

/** The "well-known" compiler. At the moment, some back end parts make assumptions base on this */
export type CompilerVariant = 'msvc' | 'clang' | 'gcc';

/** A requirement that the path to the discovered binary matches a given regular expression */
type Match = Record<'match', RegularExpression>;

/** A requirement that there is a folder relative to the location of the discovered binary */
type Folder = Record<'folder', Expression>;

/** A requirement that there is a file relative to the location of the discovered binary */
type File = Record<'file', Expression>;

/** A requirement to find a string in the binary itself */
type Rx = Record<'regex', Expression>;

/** The (passive) requirements to discover a binary  */
export interface Discover {
  binary: OneOrMore<RegularExpression>;
  locations?: OneOrMore<string>;
  requirements?: Record<string, Match|Folder|File|Rx>;
}

/** The Target specifies what the compiler is supposed to be outputting */
export interface Target {
  /** Well-known compiler variant (currently, just the three) */
  compiler?: CompilerVariant;

  /** the target platform */
  platform?: Platform;

  /** The target CPU/Processor architecture */
  architecture?: Architecture;

  /** The 'bit width' of the compiler */
  bits?: 64 | 32 | 16 | 8;

  /** additional arguments that are being passed to the compiler */
  compilerArgs?: OneOrMore<string>; // arguments that are assumed to be passed to the compiler on the command line
}

/** The declared 'default' properties that are */
export interface DefaultProperties {
  /** the file paths that indicate default #include locations  */
  includePath?: OneOrMore<Expression>;

  /** #defines that are implicitly specified so that the backend understands how to handle the code */
  defines?: Record<string,string>;

  /** the C++ standard that this toolset supports */
  cppStandard?: CppStandard | number;

  /** the C Standard that this toolset supports */
  cStandard?: CStandard | number;

  /** The settings for what the toolset is targeting */
  target?: Target;

  /** paths to files that are forcibly #included */
  forcedInclude?: OneOrMore<Expression>;

  /** unstructured data that can be passed thru to help the backend figure out what to do */
  additionalProperties? : Record<string, OneOrMore<Expression>>;
}

/** The interface for the toolset.XXX.json file */
export interface DefinitionFile {
  /** The cosmetic name for the toolkit */
  name: string;

  /** The cosmetic version for the toolkit */
  version?: string;

  /** files to automatically load and merge */
  import?: OneOrMore<string>;

  /** Describes the steps to find this toolkit */
  discover: Discover;

  /** Query steps to ask the compiler (by executing it) about its settings */
  query?: Query;

  /** Analysis steps to take the gathered data and transform it for the backend */
  analysis?: Analysis;

  /** Explicitly declared settings about this toolset */
  defaults?: DefaultProperties;

  /** The package identities if we are interested in bootstrapping it. */
  package?: Package;

  /** Conditional events that allow us to overlay additional configuration when a condition is met */
  conditions?: Record<string, OneOrMore<string>|PartialDefinitionFile>;
}

/** Analysis phase declarations */
export interface Analysis {
  /** Custom steps to trigger (ie, specific built-in actions) */
  customSteps?: OneOrMore<string>;

  /**
   * A map of <engineered regex sequences> to <what to apply when it matches>
   *
   * "engineered regex sequence" is a packed string that is semicolon separated regular expressions
   * each regular expression will have '^'' and '$'' added to assume that a full argument must be matched
   * tagged template literals (${}) are processed before anything else, ( which we can use for built-in macros)
   * after that, the seqence of regular expressions is split
   * when there are more than one, all of the regular expressions should match arguments in order (from the current arg)
   * so "-D;(?<val>.*)" would be valid if a -D parameter was followed by anything.
   *
   * the analysis phase is run, and the compiler args are run thru the list of the regular expressions
   * if a match is found, the data is applied to the toolset block, and the args are consumed/dropped
   * (unless keep:true is in the apply block)
   *
   * Since they are run in order, the first match wins, and the args are consumed (unless 'keep:true' is specified).
   */
  compilerArgs: Record<string, Record<string, any>>;
}

/** A partial definition file */
export type PartialDefinitionFile = DeepPartial<DefinitionFile>;
