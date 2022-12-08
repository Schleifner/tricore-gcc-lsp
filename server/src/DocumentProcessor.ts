import { TextDocument } from 'vscode-languageserver-textdocument';

import { Context } from "./context";
import Parser from './parser/parser';

export interface ProcessedDocument {
	document: TextDocument;
}

export type ProcessedDocumentStore = Map<string, ProcessedDocument>;

export default class DocumentProcessor {

	constructor(protected readonly ctx: Context) { }

	process(document: TextDocument) {
		const parser = new Parser(document.getText());
		const diagnostics = parser.parse_a_document();
		const processed: ProcessedDocument = { document };
		this.ctx.store.set(document.uri, processed);
		return diagnostics;
	}
}