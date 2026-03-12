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
		restartGdbTerminal (notebook);
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
    controller.supportedLanguages = ["code", "markdown", "plaintext", "shellscript", "gdb_command", "extension_command"];

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
	let isRestarted = false;
	
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
		let line = cmd.trimStart ();
                if (line === "") continue; // 空行は飛ばす
		if (line.startsWith ("#")) continue; // コメント行も飛ばす
		if (line == "!restart" || line == "!start") {
		    restartGdbTerminal (notebook);
		    isRestarted = true;
		} else {
		    // 先頭の "(gdb) " や "$ " を削除してから送信
		    if (line.startsWith ("(gdb)")) {
			line = line.slice ("(gdb)".length).trimStart();
		    } else if (line.startsWith ("$")) {
			line = line.slice ("$".length).trimStart();
		    }
                    gdbTerminal!.sendText (line);
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

	    // 美しくないけど，セル出力を消去（チェックマークは消えない）
	    if (isRestarted) {
		executionCounter = 1;
		notebook.getCells ().forEach (cell => {
		    const execution = controller.createNotebookCellExecution (cell);
		    execution.start ();
		    // execution.replaceOutput ([]); // クリア
		    execution.clearOutput (); // クリア
		    execution.end (true);
		});
	    }
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

async function restartGdbTerminal (notebook: vscode.NotebookDocument) {
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
	    
	    let first_line;
	    const lines = item.value.split ('\n');
	    for (const line of lines) {
		if (!line.trimStart ().startsWith ("#")) {
		    first_line = line.trimStart ();
		    break;
		}
	    }
	    // console.log ("first_line: " + first_line);

            let lang;
	    if (kind === vscode.NotebookCellKind.Code) {
		if (first_line.trimStart ().startsWith ("$")) {
		    lang = "shellscript";
		} else if (first_line.startsWith ("!")) {
		    lang = "extension_command";
		} else {
		    lang = "gdb_command";
		}
	    } else {
		lang = "markdown";
	    }
	    // console.log ("lang: " + lang);
	    
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
