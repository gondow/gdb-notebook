import * as vscode from "vscode";
import * as path   from "path";
import * as fs     from "fs";
import JSON5 from "json5";

type CommandData = {
    exp:   string;             // 説明文
    usage: [string, string][]; // 使用例（「使用例と説明」のリスト）
    url:   string;             // 関連URL
};

let executionCounter = 1;
let controller: vscode.NotebookController;
let helpProvider: GdbHelpViewProvider;
let aliasMap:   Record<string, string>;
let commandMap: Record<string, CommandData>;
let shellCommandMap: Record<string, CommandData>;
const extensionCommandMap: Record<string, string> = {
    "restart": "GDBターミナルを再起動して，このノートブックをリセット\n（ターミナル上では実行不可）"
};

const terminalMap = new Map<string, vscode.Terminal> ();

export function activate (context: vscode.ExtensionContext) {
    console.log ('your extension "gdb-notebook" is now active!');
    vscode.window.showInformationMessage ('Hello gdb-notebook');

    // ./grammar.json から，aliasMap, commandMap を取得する
    const grammar_json_path = context.asAbsolutePath ("./src/grammar.json")
    console.log (grammar_json_path);
    const grammar_json = fs.readFileSync (grammar_json_path, "utf-8");
    const grammar_data = JSON5.parse (grammar_json)
    aliasMap   = grammar_data.gdb_command.aliasMap;
    commandMap = grammar_data.gdb_command.commandMap;
    shellCommandMap = grammar_data.shell_command.commandMap;
    console.log (JSON.stringify (shellCommandMap, null, 2));

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
    
    controller.executeHandler = async (cells, notebook) => {
	let isRestarted = false;
	
	// ターミナルがなければまず作る
	getOrCreateTerminal (notebook);

        for (const cell of cells) {
            const execution = controller.createNotebookCellExecution (cell);
            execution.start();

            // Markdownセルはスキップ
            if (cell.kind !== vscode.NotebookCellKind.Code) {
                execution.end (true);
                continue;
            }

	    console.log ("languageId = " + cell.document.languageId + ", " + cell.document.getText ());

            // セル内容をターミナルに送信
            const commands = cell.document.getText ().split ("\n");
            for (const cmd of commands) {
		let line = cmd.trimStart ();
                if (line === "") continue; // 空行は飛ばす
		if (line.startsWith ("#")) continue; // コメント行も飛ばす
		if (line == "!restart" || line == "!start") {
		    restartGdbTerminal (notebook);
		    isRestarted = true;
		} else if (line == "!fold") {
		    // 特定のセルを折りたたむ
		    const editor = vscode.window.activeNotebookEditor;
		    if (!editor) return;
		    const notebook = editor.notebook;
		    let i = 0, start, last = notebook.getCells ().length - 1;
		    for (const cell of notebook.getCells ()) {
			const line = cell.document.getText ();
			console.log (i++ + ": " + line);
			if (line.match ("#.*答")) {
			    start = i;
			}
		    }
		    console.log ("start = " + start + ", last = " + last);
		    await vscode.commands.executeCommand ("notebook.cell.quitEdit");

		    editor.selection = new vscode.NotebookRange (0, 1);
		    await vscode.commands.executeCommand ("notebook.fold");
		} else {
		    // 先頭の "(gdb) " や "$ " を削除してから送信
		    if (line.startsWith ("(gdb)")) {
			line = line.slice ("(gdb)".length).trimStart ();
		    } else if (line.startsWith ("$")) {
			line = line.slice ("$".length).trimStart ();
		    }
		    const term = getOrCreateTerminal (notebook);
		    if (term) {
			term.sendText (line);
		    }
		}
            }

	    if (isRestarted) {
		execution.replaceOutput ([
                    new vscode.NotebookCellOutput ([
			vscode.NotebookCellOutputItem.text (
			    `[${executionCounter}] ` + "GDBターミナルを再起動して，このノートブックをレセットしました")
                    ])
		]);
	    } else {
            // ターミナル送信したのでセルは「完了」にする
		execution.replaceOutput ([
                    new vscode.NotebookCellOutput ([
			vscode.NotebookCellOutputItem.text (
			    `[${executionCounter}] ` + "GDBターミナルにコマンド送信済み")
                    ])
		]);
		executionCounter++;
	    }

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
	vscode.workspace.onDidOpenNotebookDocument (async (notebook) => {
            if (notebook.notebookType !== "gdb-notebook") { return; }
	    getOrCreateTerminal (notebook);

	    // フォルダをワークスペースとして開く
	    const uri = vscode.Uri.file (path.dirname (notebook.uri.fsPath));
	    console.log (uri);
	    await vscode.commands.executeCommand ("vscode.openFolder", uri, false);
	    // true=新しいウィンドウ
	})
    );

    context.subscriptions.push (
	vscode.window.onDidCloseTerminal (closed => {
	    for (const [key, term] of terminalMap.entries ()) {
		if (term === closed) {
		    terminalMap.delete (key);
		}
	    }
	})
    );

    context.subscriptions.push (
	vscode.workspace.onDidCloseNotebookDocument (nb => {
	    closeTerminal (nb);
	})
    );

    context.subscriptions.push (
	vscode.window.onDidChangeActiveNotebookEditor (async editor => {
	    if (!editor) return;
	    const notebook = editor.notebook;
	    // 対応するGDBターミナルを表示する
	    const term = getOrCreateTerminal (notebook);
	    if (term) {
		term.show ();
	    }

	    // 特定のセルを折りたたむ
	    let i = 0, start = 0;
	    for (const cell of notebook.getCells ()) {
		const line = cell.document.getText ();
		console.log (i + ": " + line);
		if (line.match ("#.*答")) {
		    start = i;
		    break;
		}
		i++;
	    }
	    console.log ("start = " + start);
	    // setTimeout (async () => {
	    // await vscode.window.showNotebookDocument (notebook);
	    // await vscode.commands.executeCommand ("notebook.cell.quitEdit");
	    // notebook.fold には引数は無く，事前に折りたたむセクションを含む
	    // マークダウンセルを選択しておく必要がある．
	    editor.selection = new vscode.NotebookRange (start, start+1);
	    await vscode.commands.executeCommand ("notebook.fold");
	    console.log ("notebook.fold executed");
	    // }, 300);
	})
    );
    
    context.subscriptions.push (
	vscode.languages.registerCodeLensProvider (
	    [
		{ language: "gdb_command", scheme: "vscode-notebook-cell" },
		{ language: "shellscript", scheme: "vscode-notebook-cell" },
		{ language: "extension_command", scheme: "vscode-notebook-cell" }
	    ],
            new GdbCodeLensProvider ()
	)
    );

    context.subscriptions.push (
	vscode.commands.registerCommand (
            "gdb-notebook.showLink",
            (cmd: string) => {
		const url = vscode.Uri.parse ('https://gondow.github.io/linux-x86-64-programming/10-gdb.html#%E5%A4%89%E6%95%B0%E3%81%AE%E5%80%A4%E3%82%92%E8%A1%A8%E7%A4%BA-print');
		vscode.env.openExternal (url);
		// vscode.window.showInformationMessage (cmd, "OK");
	    }
	)
    );

    context.subscriptions.push (
	vscode.commands.registerCommand (
            "gdb-notebook.showHelp",
            (command_data: CommandData) => { helpProvider.showHelp (command_data); }
	)
    );
    console.log ("CodeLens registered");

    registerGdbHover (context);

    const panel = vscode.window.createWebviewPanel(
	"gdbHelp",
	"GDB Help",
	vscode.ViewColumn.Active,
	{}
    );
    
    panel.webview.html = `
<html>
<body style="font-family: monospace; padding: 10px;">
<h3>breakの省略形，ブレークポイントをセットする</h3>
<b>使用例</b>
<pre>
b main         # main関数でブレーク
b file.c:10    # ファイルfile.cの10行目でブレーク
b 42           # （現在のファイルの）42行目でブレーク
</pre>
</body>
</html>
`;

    helpProvider = new GdbHelpViewProvider ();
    context.subscriptions.push (
	vscode.window.registerWebviewViewProvider ("gdbHelpView", helpProvider)
    );
}

export function deactivate () {
    vscode.window.showInformationMessage ('Deactivated');

    vscode.window.terminals.forEach (terminal => { terminal.dispose(); });
}

function closeTerminal (nb: vscode.NotebookDocument) {
    const key = nb.uri.toString ();
    const term = terminalMap.get (key);
    if (term) {
	term.dispose ();
	terminalMap.delete (key);
    }
}

function getOrCreateTerminal (nb: vscode.NotebookDocument): vscode.Terminal {
    const key = nb.uri.toString ();
    let term = terminalMap.get (key);
    if (!term) {
        term = vscode.window.createTerminal ({
            name: `GDB: ${nb.uri.path.split ('/').pop ()}`,
	    cwd: path.dirname (nb.uri.fsPath)
        });
	term.show ();
        terminalMap.set (key, term);
    }
    return term;
}

async function restartGdbTerminal (nb: vscode.NotebookDocument) {
    closeTerminal (nb);
    await new Promise (resolve => setTimeout (resolve, 50));
    getOrCreateTerminal (nb);
}


class GdbSerializer implements vscode.NotebookSerializer {
    // 読み込み
    async deserializeNotebook (content: Uint8Array) {
	const text = new TextDecoder ().decode (content);
	const raw = JSON.parse(text);
	
	const cells = raw.cells.map ((item: any) => {
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
	const cells = data.cells.map (cell => ({
            kind: (cell.kind === vscode.NotebookCellKind.Code
		   ? "code" : "markdown"),
            value: cell.value
	}));
	const json = JSON.stringify ({cells}, null, 2);
	
	return new TextEncoder ().encode (json);
    }
}

function registerGdbHover (context: vscode.ExtensionContext) {

    context.subscriptions.push (
	vscode.languages.registerHoverProvider (
            { scheme: 'vscode-notebook-cell', language: 'gdb_command' },
            {
		provideHover (document, position, token) {
                    const range = document.getWordRangeAtPosition (position);
                    if (!range) return;
                    const word = document.getText (range);
		    const text = commandMap [aliasMap [word] ?? word].exp;
		    console.log ("commandMap [word] = " + text);
                    if (text) { return new vscode.Hover (text, range); }
		}
            }
	)
    );

    context.subscriptions.push (
	vscode.languages.registerHoverProvider (
            { scheme: 'vscode-notebook-cell', language: 'shellscript' },
            {
		provideHover (document, position, token) {
                    const range = document.getWordRangeAtPosition (position);
                    if (!range) return;
                    const word = document.getText (range);
		    const text = shellCommandMap [word].exp;
		    console.log ("shellCommandMap [word] = " + text);
                    if (text) { return new vscode.Hover (text, range); }
		}
            }
	)
    );

    context.subscriptions.push (
	vscode.languages.registerHoverProvider (
            { scheme: 'vscode-notebook-cell', language: 'extension_command' },
            {
		provideHover (document, position, token) {
                    const range = document.getWordRangeAtPosition (position);
                    if (!range) return;
                    const word = document.getText (range);
		    const text = extensionCommandMap [word];
		    console.log ("extensionCommandMap [" + word + "] = " + text);
                    if (text) { return new vscode.Hover (text, range); }
		}
            }
	)
    );
}

class GdbCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses (document: vscode.TextDocument): vscode.CodeLens [] {
	console.log ("CodeLens called");
	console.log ("language:", document.languageId);
	console.log ("scheme:", document.uri.scheme);

	const gdb_alias_keys = Object.keys (aliasMap);
	const gdb_canon_keys = Object.keys (commandMap);
	const shell_command_keys = Object.keys (shellCommandMap);

        const lenses: vscode.CodeLens [] = [];

	// console.log (gdb_alias_keys);

	outer_loop:
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt (i);
            const text = line.text.trim ();
	    console.log ("======:" + line.text);
	    // コマンドは（トリム後の）行頭に限定（高速化のため）
	    // break-if だけ特別処理
	    for (const key of gdb_alias_keys) {
		let alias_line = text;
		if (alias_line.startsWith ("(gdb)")) {
		    alias_line = alias_line.slice ("(gdb)".length).trimStart ();
		}
		console.log ("alias_line: " + alias_line);
		if (alias_line.match ("^" + key + "\\b")) {
		    console.log ("alias matched: " + line.text + ", " + key);
                    const range = new vscode.Range (i, 0, i, 0);
                    lenses.push (new vscode.CodeLens (range, {
			title: "説明",
			command: "gdb-notebook.showHelp",
			arguments: [ commandMap [aliasMap [key]] ]
		    }));
                    lenses.push (new vscode.CodeLens (range, {
			title: "関連リンク",
			command: "gdb-notebook.showLink",
			arguments: [commandMap [aliasMap [key]].url]
		    }));

		    continue outer_loop;
		}
	    }

	    for (const key of gdb_canon_keys) {
		let canon_line = text;
		if (canon_line.startsWith ("(gdb)")) {
		    canon_line = canon_line.slice ("(gdb)".length).trimStart ();
		}
		if (canon_line.match ("^" + key + "\\b")) {
		    console.log ("canon matched: " + line.text + ", " + key);
                    const range = new vscode.Range (i, 0, i, 0);
                    lenses.push (new vscode.CodeLens (range, {
			title: "説明",
			command: "gdb-notebook.showHelp",
			arguments: [ commandMap [key] ]
		    }));
                    lenses.push (new vscode.CodeLens (range, {
			title: "関連リンク",
			command: "gdb-notebook.showLink",
			arguments: [commandMap [key].url]
		    }));

		    continue outer_loop;
		}
	    }

	    console.log (shell_command_keys);
	    for (const key of shell_command_keys) {
		let shell_line = text;
		if (shell_line.startsWith ("$")) {
		    shell_line = shell_line.slice ("$".length).trimStart ();
		}
		if (shell_line.match ("^" + key + "\\b")) {
		    console.log ("shell matched: " + line.text + ", " + key);
                    const range = new vscode.Range (i, 0, i, 0);
                    lenses.push (new vscode.CodeLens (range, {
			title: "説明",
			command: "gdb-notebook.showHelp",
			arguments: [ shellCommandMap [key] ]
		    }));
                    lenses.push (new vscode.CodeLens (range, {
			title: "関連リンク",
			command: "gdb-notebook.showLink",
			arguments: [ shellCommandMap [key].url]
		    }));

		    continue outer_loop;
		}
	    }
        }
        return lenses;
    }
}

class GdbHelpViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = "gdbHelpView";
    private view?: vscode.WebviewView;

    resolveWebviewView (view: vscode.WebviewView) {
	this.view = view;

	view.webview.options = {
	    enableScripts: false
	};
	
	view.webview.html = `
<html>
<body style="font-family: monospace">
<pre>GDB Help</pre>
</body>
</html>
`;
    }
    
    showHelp (command_data: CommandData) {
	if (this.view) {
	    // this.view.webview.html = `<pre>${text}</pre>`;
	    const tr_list_html = command_data.usage.map (([cmd, desc]) => {
		return `<tr><td><code>${cmd}</code></td><td>${desc}</td></tr>`
	    }).join ("\n");
	    console.log (tr_list_html);
	    this.view.webview.html = `<html>
<h3> ${command_data.exp} </h3>
<table border="1">
  <thead> <tr> <th>コマンド使用例</th> <th>説明</th> </tr> </thead>
  <tbody> ${tr_list_html} </tbody>
</table>
<a href=${command_data.url}>関連リンク</a>
</html>`;
	}
    }
}
