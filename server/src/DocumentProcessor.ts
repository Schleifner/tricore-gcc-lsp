import { TextDocument } from 'vscode-languageserver-textdocument';

import { Context } from "./context";
import Parser from './parser/parser';

export interface ProcessedDocument {
	document: TextDocument;
}

export type ProcessedDocumentStore = Map<string, ProcessedDocument>;

export default class DocumentProcessor {
	private parser: Parser;

	constructor(protected readonly ctx: Context) {
		this.parser = new Parser("");
	}

	process(document: TextDocument) {
		const diagnostics = this.parser.parse_a_document();
		// this.ctx.connection.sendDiagnostics({
		// 	uri: document.uri,
		// 	diagnostics
		// });
	}
}