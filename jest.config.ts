import type { Config } from 'jest';

const config: Config = {
	roots: ['server/tests'],
	preset: 'ts-jest',
	testEnvironment: 'node'
}

export default config;