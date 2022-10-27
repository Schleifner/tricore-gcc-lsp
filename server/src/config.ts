import { Compiler } from './parser/parser';

export interface Config {
	compilers: Compiler;
}

const defaultConfig: Config = {
	compilers: "tasking"
};

export function mergeDefaults(config: Partial<Config>): Config {
	return {
		...defaultConfig,
		...config
	}
}