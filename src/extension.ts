import * as vscode from 'vscode';
import * as path from "path";

let gdbTerminal: vscode.Terminal | undefined;
let executionCounter = 1;
let controller: vscode.NotebookController;

export function activate (context: vscode.ExtensionContext) {
    console.log ('your extension "gdb-notebook" is now active!');
    vscode.window.showInformationMessage ('Hello gdb-notebook');

    context.subscriptions.push (
	vscode.commands.registerCommand ('gdb-notebook.helloWorld', () => {
	    vscode.window.showInformationMessage('Hello from gdb-notebook!');
	})
    );

    context.subscriptions.push (
	vscode.commands.registerCommand ('gdb-notebook.restartGdbTerminal', () => {
	    const editor = vscode.window.activeNotebookEditor;
	    const notebook = editor?.notebook;
	    if (notebook) {
		restartGdbTerminal (notebook, undefined);
	    }
	})
    );

    context.subscriptions.push (
	vscode.workspace.registerNotebookSerializer (
	    "gdb-notebook", new GdbSerializer (), {transientOutputs: false}
	)
    );

    controller = vscode.notebooks.createNotebookController (
	"gdb-controller", "gdb-notebook", "Gdb Controller");
    controller.supportedLanguages = ["code", "markdown"];

    /*
    controller.executeHandler = async (cells) => {
	for (const cell of cells) {
	    const execution =
		  controller.createNotebookCellExecution (cell);
	    execution.start ();
	    const text = cell.document.getText ();
	    const result = text.toUpperCase ();
	    execution.replaceOutput ([
		new vscode.NotebookCellOutput ([
		    vscode.NotebookCellOutputItem.text (result)
		])
	    ]);
	    execution.end (true);
	}
    };
    */
    
    controller.executeHandler = async (cells, notebook) => {
	// ターミナルがなければまず作る
	createGdbTerminal (notebook);

        for (const cell of cells) {
            const execution = controller.createNotebookCellExecution (cell);
            execution.start();

            // Markdownセルはスキップ
            if (cell.kind !== vscode.NotebookCellKind.Code) {
                execution.end (true);
                continue;
            }

            // セル内容をターミナルに送信
            const commands = cell.document.getText ().split ("\n");
            for (const cmd of commands) {
		const line = cmd.trim ();
                if (line === "") continue; // 空行は飛ばす
		if (line.startsWith ("#")) continue; // コメント行も飛ばす
		if (line == "!restart" || line == "!start") {
		    restartGdbTerminal (notebook, execution);
		} else {
                    gdbTerminal!.sendText (cmd);
		}
            }

            // ターミナル送信したのでセルは「完了」にする
            execution.replaceOutput ([
                new vscode.NotebookCellOutput ([
                    vscode.NotebookCellOutputItem.text (
			`[${executionCounter}] ` + "GDBターミナルに送信済み")
                ])
            ]);

	    executionCounter++;
            execution.end (true);
        }
    };

    context.subscriptions.push (controller);

    context.subscriptions.push (
	vscode.workspace.onDidOpenNotebookDocument ((notebook) => {
            if (notebook.notebookType !== "gdb-notebook") { return; }
	    createGdbTerminal (notebook);
	})
    );

    context.subscriptions.push (
	vscode.window.onDidCloseTerminal (terminal => {
	    if (terminal === gdbTerminal) {
		gdbTerminal = undefined;
	    }
	})
    );
}

export function deactivate () {
    vscode.window.showInformationMessage ('Deactivated');
}

function createGdbTerminal (notebook: vscode.NotebookDocument) {
    const cwd = path.dirname (notebook.uri.fsPath);
    if (!gdbTerminal) {
	gdbTerminal = vscode.window.createTerminal ({name: "GDB", cwd: cwd});
        gdbTerminal.show ();
    }
}

async function restartGdbTerminal (notebook: vscode.NotebookDocument,
			     execution: vscode.NotebookCellExecution | undefined) {
    executionCounter = 1;
    if (execution) {
	notebook.getCells ().forEach (cell => {
	    execution.replaceOutput ([]); // クリア
	});
    } else {
	notebook.getCells ().forEach (cell => {
	    const execution = controller.createNotebookCellExecution (cell);
            execution.start ();
	    execution.replaceOutput ([]); // クリア
	    execution.end (true);
	});
    }

    if (gdbTerminal) {
	gdbTerminal.dispose();
	gdbTerminal = undefined;
    }
    await new Promise (resolve => setTimeout (resolve, 50));
    createGdbTerminal (notebook);
}

class GdbSerializer implements vscode.NotebookSerializer {
    // 読み込み
    async deserializeNotebook (content: Uint8Array) {
	const text = new TextDecoder ().decode (content);
	const raw = JSON.parse(text);
	
	/*
	const cells = text.split ("\n").map (line =>
					     new vscode.NotebookCellData (
						 vscode.NotebookCellKind.Code,
						 line,
						 "plaintext"
					     )
					    );
	*/
	const cells = raw.cells.map((item: any) => {
            const kind = (item.kind === "code"
			  ? vscode.NotebookCellKind.Code
			  : vscode.NotebookCellKind.Markup);
	    
            const lang = (kind === vscode.NotebookCellKind.Code
			  ? "code" : "markdown");
	    
            return new vscode.NotebookCellData (kind, item.value, lang);
	});
	return new vscode.NotebookData (cells);
    }
    
    // 書き込み
    async serializeNotebook (data: vscode.NotebookData) {
	/*
	const text = data.cells.map (cell => cell.value).join ("\n");
	return new TextEncoder ().encode (text);
	*/

	const cells = data.cells.map (cell => ({
            kind: (cell.kind === vscode.NotebookCellKind.Code
		   ? "code" : "markdown"),
            value: cell.value
	}));
	const json = JSON.stringify ({cells}, null, 2);
	
	return new TextEncoder().encode(json);
    }
}
