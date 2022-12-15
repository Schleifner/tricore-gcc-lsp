import { createConnection } from "vscode-languageserver/node";
import * as lsp from "vscode-languageserver";

import registerProviders from './providers';
import { createContext } from "./context";

const connection = createConnection(lsp.ProposedFeatures.all);

connection.onInitialize((params) => {
	const ctx = createContext(
		connection.console,
		connection,
	);

	const capabilities = registerProviders(connection, ctx, params.capabilities);
	
	return { capabilities };
});

connection.listen();

export default connection;