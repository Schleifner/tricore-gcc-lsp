import * as lsp from "vscode-languageserver";

import { ProcessedDocumentStore } from './DocumentProcessor';
import { Config, mergeDefaults } from "./config";

export interface Context {
	store: ProcessedDocumentStore;
	logger: lsp.Logger;
	connection: lsp.Connection;
	config: Config;
}

export function createContext(
	logger: lsp.Logger,
	connection: lsp.Connection,
	config: Partial<Config>
): Context {
	return {
		store: new Map(),
		logger,
		connection,
		config: mergeDefaults(config),
	}
}