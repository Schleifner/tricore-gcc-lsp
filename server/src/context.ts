import * as lsp from "vscode-languageserver";

import { ProcessedDocumentStore } from './DocumentProcessor';

export interface Context {
	store: ProcessedDocumentStore;
	logger: lsp.Logger;
	connection: lsp.Connection;
}

export function createContext(
	logger: lsp.Logger,
	connection: lsp.Connection,
): Context {
	return {
		store: new Map(),
		logger,
		connection,
	};
}