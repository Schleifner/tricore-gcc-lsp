import * as lsp from "vscode-languageserver";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from 'vscode-languageserver-textdocument';

import { Provider } from '.';
import { Context } from '../context';
import DocumentProcessor from "../DocumentProcessor"; 
import { ParserDiagnostic } from "../parser/parser";

export default class TextDocumentSyncProvider implements Provider {
	private connection: lsp.Connection;
	private processor: DocumentProcessor;

	constructor(protected readonly ctx: Context) {
		this.connection = ctx.connection;
		this.processor = new DocumentProcessor(ctx);
	}

	parseDiagnostic(source: ParserDiagnostic[]): Diagnostic[] {
		return source.map(({ line, message }) => {
			return {
				range: {
					start: { line, character: 0 },
					end: { line: line + 1, character: 0 }
				},
				message,
				severity: DiagnosticSeverity.Error,
				source: "Tricore Assembly",
			}
		});
	}

	process(uri:string, document: TextDocument) {
		const parserDiagnostics = this.processor.process(document);
		let lspDiagnostics = this.parseDiagnostic(parserDiagnostics);
		this.connection.sendDiagnostics({
			uri,
			diagnostics: lspDiagnostics,
		});
	}

	onDidOpenTextDocument({
		textDocument: { uri, languageId, text, version },
	}: lsp.DidOpenTextDocumentParams) {
		const document = TextDocument.create(uri, languageId, version, text );
		this.process(uri, document);
	}

	onDidChangeTextDocument({
		textDocument: { uri, version },
		contentChanges,
	}: lsp.DidChangeTextDocumentParams) {
		const existDocument = this.ctx.store.get(uri);
		if (!existDocument) {
			return;
		}
		const updatedDoc = TextDocument.update(existDocument.document, contentChanges, version);
		this.process(uri, updatedDoc);
	}

	onDidSaveTextDocument({
		textDocument: { uri },
	}: lsp.DidSaveTextDocumentParams) {
		const existDocument = this.ctx.store.get(uri);
		if (!existDocument) {
			return;
		}
		this.process(uri, existDocument.document);
	}

	register(connection: lsp.Connection, capabilities: lsp.ClientCapabilities): lsp.ServerCapabilities<any> {
		connection.onDidOpenTextDocument(this.onDidOpenTextDocument.bind(this));
		connection.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this));
		connection.onDidSaveTextDocument(this.onDidSaveTextDocument.bind(this));
		return {
			textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
		}
	}
}