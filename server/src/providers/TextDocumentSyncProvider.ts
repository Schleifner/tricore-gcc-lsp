import * as lsp from "vscode-languageserver";
import { TextDocument } from 'vscode-languageserver-textdocument';

import { Provider } from '.';
import { Context } from '../context';
import DocumentProcessor from "../DocumentProcessor"; 

export default class TextDocumentSyncProvider implements Provider {
	private connection: lsp.Connection;
	private processor: DocumentProcessor;

	constructor(protected readonly ctx: Context) {
		this.connection = ctx.connection;
		this.processor = new DocumentProcessor(ctx);
	}

	onDidOpenTextDocument({
		textDocument: { uri, languageId, text, version },
	}: lsp.DidOpenTextDocumentParams) {
		const document = TextDocument.create(uri, languageId, version, text );
	}

	onDidChangeTextDocument({
		textDocument: { uri, version },
		contentChanges,
	}: lsp.DidChangeTextDocumentParams) {

	}

	onDidSaveTextDocument({
		textDocument: { uri },
	}: lsp.DidSaveTextDocumentParams) {

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