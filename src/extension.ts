import * as vscode from "vscode";
import * as path   from "path";
import * as fs     from "fs";
import JSON5 from "json5";
// import 'source-map-support/register'; // for ts->js行番号変換
if (process.env.NODE_ENV === "development") {
    require ("source-map-support/register");
}

type CommandData = {
    exp:   string;             // 説明文
    usage: [string, string][]; // 使用例（「使用例と説明」のリスト）
    url:   string;             // 関連URL
};

let extension_context: vscode.ExtensionContext;
let executionCounter = 1;
let controller: vscode.NotebookController;
let helpProvider: CommandHelpViewProvider;
let aliasMap:   Record<string, string>;
let commandMap: Record<string, CommandData>;
let shellCommandMap: Record<string, CommandData>;
const extensionCommandMap: Record<string, string> = {
    "restart": "GDBNBターミナルを再起動して，このノートブックをリセット\n（ターミナル上では実行不可）"
};

const terminalMap = new Map<string, vscode.Terminal> ();

function abort (msg: string): never {
    const err = new Error (msg);
    // console.error (err);
    console.error (err.stack!.split ("\n").slice (0, 4).join ("\n"));
    throw err;
}

function access<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] {
    if (obj == null) {
	abort (`Cannot access property "${String(key)}" of ${obj}`);
    }
    const value = obj [key];
    if (value === undefined) {
	abort (`Property "${String(key)}" does not exist`);
    }
    return value;
}

function str2command_data (str: string) {
    let command_data: CommandData;
    const key = aliasMap [str];
    if (key != null && commandMap [key]) {
	command_data = commandMap [key];
    } else if (commandMap [str]) {
	command_data = commandMap [str];
    } else if (shellCommandMap [str]) {
	command_data = shellCommandMap [str];
    } else {
	abort (`map not found for ${str}`);
    }
    return command_data;
}

function command_data2md (command_data: CommandData) {
    const tr_list_md = command_data.usage.map (([cmd, desc]) => {
	return `|\`${cmd}\`|${desc}|`
    }).join ("\n");
    console.log ("tr_list_md = " + tr_list_md);
    const md =  new vscode.MarkdownString (`
### ${command_data.exp}
---
|コマンド使用例|説明|
|--|--|
${tr_list_md}
---
[関連リンク](${command_data.url})`
					      );
    return md;
}

export async function activate (context: vscode.ExtensionContext) {
    console.log ('your extension "gdb-notebook" is now active!');
    vscode.window.showInformationMessage ('Hello gdb-notebook');

    extension_context = context;

    // ゴミとして残っているターミナルを最初に閉じておく
    vscode.window.terminals.forEach (terminal => {
	if (terminal.name.startsWith ("GDBNB")) {
	    terminal.dispose ();
	}
    });

    
    // ./grammar.json から，aliasMap, commandMap を取得する
    // const grammar_json_path = context.asAbsolutePath ("./out/grammar.json")
    const grammar_json_path = vscode.Uri.joinPath (context.extensionUri, "./out/grammar.json").fsPath;
    console.log (grammar_json_path);
    const grammar_json = fs.readFileSync (grammar_json_path, "utf-8");
    const grammar_data = JSON5.parse (grammar_json)
    aliasMap   = grammar_data.gdb_command.aliasMap;
    commandMap = grammar_data.gdb_command.commandMap;
    shellCommandMap = grammar_data.shell_command.commandMap;
    // console.log (JSON.stringify (shellCommandMap, null, 2));

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

	    // console.log ("languageId = " + cell.document.languageId + ", " + cell.document.getText ());

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
			i++;
			// console.log (i + ": " + line);
			if (line.match ("#.*答")) {
			    start = i;
			}
		    }
		    // console.log ("start = " + start + ", last = " + last);
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
			    `[${executionCounter}] ` + "GDBNBターミナルを再起動して，このノートブックをレセットしました")
                    ])
		]);
	    } else {
            // ターミナル送信したのでセルは「完了」にする
		execution.replaceOutput ([
                    new vscode.NotebookCellOutput ([
			vscode.NotebookCellOutputItem.text (
			    `[${executionCounter}] ` + "GDBNBターミナルにコマンド送信済み")
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
	    /*
	    const uri = vscode.Uri.file (path.dirname (notebook.uri.fsPath));
	    console.log (uri);
	    await vscode.commands.executeCommand ("vscode.openFolder", uri, false);
	    */

	    const image_path = vscode.Uri.joinPath (
		context.extensionUri,
		// path.dirname (notebook.uri.fsPath),
		"images/execute-cell.png"
	    );
	    console.log ("image_path = " + image_path);
	    // const image_dir = vscode.Uri.file (path.dirname (notebook.uri.fsPath));
	    const image_dir = context.extensionUri;
	    const panel = vscode.window.createWebviewPanel(
		"gdbHelp",
		"GDBNBヒント",
		vscode.ViewColumn.Active,
		{
		    enableScripts: true,
		    localResourceRoots: [ image_dir ]
		}
	    );

	    const webview_uri = panel.webview.asWebviewUri (image_path);
	    console.log ("webview_uri = " + webview_uri);
	    
	    panel.webview.html = `
    <html>
    <body>
        <h3>ヒント：「セルの実行」ボタンの役割</h3>
        <p>
        <button onclick="send()">閉じる</button>
        <button onclick="closeWin()">閉じる（次から表示しない）</button>
        </p>

        <script>
            const vscode = acquireVsCodeApi();
            function send() {
                vscode.postMessage({ command: "send" });
            }
            function closeWin() {
                vscode.postMessage({ command: "close" });
            }
        </script>
        <p>
        <image src="${webview_uri}" width="80%"/>
        </p>
    </body>
    </html>
    `;

	    // console.log (`${path.dirname (notebook.uri.fsPath)}/images/execute-cell.png`);

	    panel.webview.onDidReceiveMessage(msg => {
		if (msg.command === "send")  { console.log ("send"); }
		if (msg.command === "close") { console.log ("close"); }
		panel.dispose(); // 送信後閉じる
	    });
	    // ======================
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
	    // 対応するGDBNBターミナルを表示する
	    const term = getOrCreateTerminal (notebook);
	    if (term) {
		term.show ();
	    }

	    // 特定のセルを折りたたむ
	    let i = 0, start = 0;
	    for (const cell of notebook.getCells ()) {
		const line = cell.document.getText ();
		// console.log (i + ": " + line);
		if (line.match ("#.*答")) {
		    start = i;
		    break;
		}
		i++;
	    }
	    // console.log ("start = " + start);
	    // setTimeout (async () => {
	    // await vscode.window.showNotebookDocument (notebook);
	    // await vscode.commands.executeCommand ("notebook.cell.quitEdit");
	    // notebook.fold には引数は無く，事前に折りたたむセクションを含む
	    // マークダウンセルを選択しておく必要がある．
	    editor.selection = new vscode.NotebookRange (start, start+1);
	    await vscode.commands.executeCommand ("notebook.fold");
	    // console.log ("notebook.fold executed");
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

    context.subscriptions.push (
	vscode.commands.registerCommand (
            "gdb-notebook.toggleCellType",
            async (doc: vscode.TextDocument) => {
		const newLang = doc.languageId === "gdb_command" ? "shellscript" : "gdb_command";
		await vscode.languages.setTextDocumentLanguage (doc, newLang);
	    }
	)
    );

    registerGdbHover (context);


    helpProvider = new CommandHelpViewProvider ();
    context.subscriptions.push (
	vscode.window.registerWebviewViewProvider ("commandHelpView", helpProvider)
    );

    // =======================
    const provider = new CommandTreeDataProvider ();
    vscode.window.createTreeView ("commandTreeView", {
        treeDataProvider: provider
    });
    // provider._onDidChangeTreeData.fire (undefined);

    
    context.subscriptions.push (
	vscode.commands.registerCommand ("example.quickpick", async () => {
	    const picked = await vscode.window.showQuickPick([
		"apple",
		"banana",
		"orange"
	    ], {
		placeHolder: "好きなフルーツを選んでください"
	    });
	    
	    if (!picked) {
		return; // キャンセル
	    }
	    
	    vscode.window.showInformationMessage(`選択: ${picked}`);
	})
    );

    // =======================
    try {
	const example_dir = vscode.Uri.joinPath (context.extensionUri, "examples");
	const example_file = vscode.Uri.joinPath (example_dir, "test.gdbnb");
	/*
	const doc = await vscode.workspace.openNotebookDocument (example_file);
	console.log ("example_file = " + example_file);
	console.log ("example_dir = " + example_dir);
	// await new Promise (resolve => setTimeout (resolve, 500));
	await vscode.window.showNotebookDocument(doc, { preview: false });
	getOrCreateTerminal (doc);
	*/

	const config = vscode.workspace.getConfiguration ("gdbNotebook");
	const autoOpenSampleFolder = config.get<boolean> ("autoOpenSampleFolder", false);
	console.log ("autoOpenSampleFolder = " + autoOpenSampleFolder);

	if (autoOpenSampleFolder) {
	    vscode.commands.executeCommand ("vscode.openFolder", example_dir);
	} else {
	    vscode.window.showInformationMessage (
		"サンプルコード用のフォルダを開きますか？\n（開かなくてもサンプルコードの実行は可能です）",
		{ modal: true },
		"開く（今回だけ）",
		"開く（今後も起動時に自動で開く）",
		"開かない"
	    ).then (async choice => {
		if (choice === "開く（今回だけ）") {
		    vscode.commands.executeCommand ("vscode.openFolder",
						    example_dir);
		} else if (choice === "開く（今後も起動時に自動で開く）") {
		    vscode.commands.executeCommand ("vscode.openFolder",
						    example_dir);
		    await config.update ("autoOpenSampleFolder", true,
					 vscode.ConfigurationTarget.Global);
		}
	    });
	}
    } catch (e) {
	console.error ("ERROR: ", e);
    }

    // =======================
}

export function deactivate () {
    vscode.window.showInformationMessage ('Deactivated');

    vscode.window.terminals.forEach (terminal => { terminal.dispose (); });
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
    const cwd = nb.uri.fsPath ? path.dirname (nb.uri.fsPath) : extension_context.extensionUri.fsPath;
    if (!term) {
        term = vscode.window.createTerminal ({
            name: `GDBNB: ${nb.uri.path.split ('/').pop ()}`,
	    cwd: cwd
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
		    const command_data = commandMap [aliasMap [word] ?? word];
		    if (command_data != null) {
			const md = command_data2md (command_data);
			return new vscode.Hover (md, range);
		    }
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
		    const text = shellCommandMap [word]!.exp;
		    // console.log ("shellCommandMap [word] = " + text);
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
		    // console.log ("extensionCommandMap [" + word + "] = " + text);
                    if (text) { return new vscode.Hover (text, range); }
		}
            }
	)
    );
}

class GdbCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses (document: vscode.TextDocument): vscode.CodeLens [] {
	// console.log ("CodeLens called");
	// console.log ("language:", document.languageId);
	// console.log ("scheme:", document.uri.scheme);

	const gdb_alias_keys = Object.keys (aliasMap);
	const gdb_canon_keys = Object.keys (commandMap);
	const shell_command_keys = Object.keys (shellCommandMap);

        const lenses: vscode.CodeLens [] = [];

        lenses.push (new vscode.CodeLens (
            new vscode.Range (0, 0, 0, 0),
	    {
		title: "セル言語の切替",
		command: "gdb-notebook.toggleCellType",
		arguments: [ document ]
	    }
	));

	outer_loop:
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt (i);
            const text = line.text.trim ();
	    // console.log ("======:" + line.text);
	    // コマンドは（トリム後の）行頭に限定（高速化のため）
	    // break-if だけ特別処理
	    for (let key of gdb_alias_keys) {
		let alias_line = text;
		if (alias_line.startsWith ("(gdb)")) {
		    alias_line = alias_line.slice ("(gdb)".length).trimStart ();
		}
		// console.log ("alias_line: " + alias_line);
		if (alias_line.match ("^" + key + "\\b")) {
                    const range = new vscode.Range (i, 0, i, 0);
		    // break-if だけ特別扱い
		    if (alias_line.match ("\\bif\\b")) {
			key = "if";
			// console.log ("********************: " + key);
		    }
		    // console.log ("alias matched: " + line.text + ", " + key);
		    const cmd = access (commandMap, access (aliasMap, key));  
                    lenses.push (new vscode.CodeLens (range, {
			title: "説明",
			command: "gdb-notebook.showHelp",
			arguments: [ cmd ]
		    }));
                    lenses.push (new vscode.CodeLens (range, {
			title: "関連リンク",
			command: "gdb-notebook.showLink",
			arguments: [ access (cmd, "url") ]
		    }));

		    continue outer_loop;
		}
	    }

	    for (let key of gdb_canon_keys) {
		let canon_line = text;
		if (canon_line.startsWith ("(gdb)")) {
		    canon_line = canon_line.slice ("(gdb)".length).trimStart ();
		}
		if (canon_line.match ("^" + key + "\\b")) {
                    const range = new vscode.Range (i, 0, i, 0);
		    // break-if だけ特別扱い
		    if (canon_line.match ("\\bif\\b")) { key = "if"; }
		    // console.log ("canon matched: " + line.text + ", " + key);
		    const cmd = access (commandMap, key);
                    lenses.push (new vscode.CodeLens (range, {
			title: "説明",
			command: "gdb-notebook.showHelp",
			arguments: [ cmd ]
		    }));
                    lenses.push (new vscode.CodeLens (range, {
			title: "関連リンク",
			command: "gdb-notebook.showLink",
			arguments: [ access (cmd, "url") ]
		    }));

		    continue outer_loop;
		}
	    }

	    // console.log (shell_command_keys);
	    for (const key of shell_command_keys) {
		let shell_line = text;
		if (shell_line.startsWith ("$")) {
		    shell_line = shell_line.slice ("$".length).trimStart ();
		}
		if (shell_line.match ("^" + key + "\\b")) {
		    // console.log ("shell matched: " + line.text + ", " + key);
                    const range = new vscode.Range (i, 0, i, 0);
		    const cmd = access (shellCommandMap, key);
                    lenses.push (new vscode.CodeLens (range, {
			title: "説明",
			command: "gdb-notebook.showHelp",
			arguments: [ cmd ]
		    }));
                    lenses.push (new vscode.CodeLens (range, {
			title: "関連リンク",
			command: "gdb-notebook.showLink",
			arguments: [ access (cmd, "url") ]
		    }));

		    continue outer_loop;
		}
	    }
        }
        return lenses;
    }
}

class CommandHelpViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = "commandHelpView";
    private view?: vscode.WebviewView;

    async resolveWebviewView (view: vscode.WebviewView) {
	this.view = view;

	view.webview.options = {
	    enableScripts: false
	};
	
	view.webview.html = `
<html>
<body style="font-family: monospace">
<pre>GDBNB Help</pre>
</body>
</html>
`;
    }
    
    async showHelp (command_data: CommandData) {
	if (!this.view) {
	    await vscode.commands.executeCommand ("commandHelpView.focus");
	    await new Promise (resolve => setTimeout (resolve, 50));
	}
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

	    await vscode.commands.executeCommand ("commandHelpView.focus");
	}
    }
}

class CommandTreeItem extends vscode.TreeItem {
    public readonly label: string;
    constructor (label: string, has_map: boolean, is_leaf: boolean) {
	if (is_leaf) {
            super (label, vscode.TreeItemCollapsibleState.None);
	} else {
            super (label, vscode.TreeItemCollapsibleState.Collapsed);
	}
	this.label = label;

	if (has_map) {
	    const command_data = str2command_data (label);
	    this.tooltip = command_data2md (command_data);
	}
    }
}

class CommandTreeDataProvider implements vscode.TreeDataProvider<CommandTreeItem> {

    public _onDidChangeTreeData = new vscode.EventEmitter<CommandTreeItem | undefined> ();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem (element: CommandTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren (element?: CommandTreeItem): CommandTreeItem [] {
        if (!element) {
            return [
		new CommandTreeItem ("GDBNBの使い方",  false, false),
                new CommandTreeItem ("シェルコマンド", false, false),
                new CommandTreeItem ("GDBコマンド",    false, false)
            ];
        }
	
	if (element.label === "GDBコマンド") {
            return Object.entries (commandMap)
		.sort (([a], [b]) => a.localeCompare (b))
		.map (([key, cmd]) => {
                return new CommandTreeItem (key, true, true);
	    });
	} else if (element.label === "シェルコマンド") {
            return Object.entries (shellCommandMap)
		.sort (([a], [b]) => a.localeCompare (b))
		.map (([key, cmd]) => {
                return new CommandTreeItem (key, true, true);
	    });
	}
	
        return [];
    }
}
