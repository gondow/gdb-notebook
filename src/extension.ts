import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import JSON5 from "json5";
// import 'source-map-support/register'; // for ts->js行番号変換
if (process.env.NODE_ENV === "development") {
    require("source-map-support/register");
}

type OptionData = {
    exp: string;  // 説明文
    usage: [string, string][]; // 使用例（「使用例と説明」のリスト）
};

type CommandData = {
    exp: string;             // 説明文
    abbr: string;             // 省略形
    usage: [string, string][]; // 使用例（「使用例と説明」のリスト）
    url: string;             // 関連URL
    subcommands?: Record<string, CommandData>; // サブコマンドのマップ
    options?: Record<string, OptionData>; // オプションのマップ 
};

type CopilotEnable =
    | boolean
    | { [language: string]: boolean };

let extension_context: vscode.ExtensionContext;
let executionCounter = 1;
let controller: vscode.NotebookController;
let helpProvider: CommandHelpViewProvider;
let aliasMap: Record<string, string>;
let commandMap: Record<string, CommandData>;
let shellCommandMap: Record<string, CommandData>;
const extensionCommandMap: Record<string, string> = {
    "gdbnb-reopen": "GDBNBファイルを再オープンして，このノートブックをリセット"
};
let gdbcodelens_provider: GdbCodeLensProvider;

// 0: smart_long, 1: smart_short, 2: all
let smart_completion_mode = 0;

const terminalMap = new Map<string, vscode.Terminal>();

// ****************************************************************
function abort(msg: string): never {
    const err = new Error(msg);
    // console.error (err);
    console.error(err.stack!.split("\n").slice(0, 4).join("\n"));
    throw err;
}

function access<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] {
    if (obj == null) {
	abort(`Cannot access property "${String(key)}" of ${obj}`);
    }
    const value = obj[key];
    if (value === undefined) {
	abort(`Property "${String(key)}" does not exist`);
    }
    return value;
}

function extract_set(key: string, data: string[]): string[] {
    const prompt = key === "shellscript" ? "$" : "(gdb)";
    const list = data.flatMap(line => {
	return line
	    .split("\n")              // 行分割
	    .map(l => l.trim())
	    .filter(l => l.startsWith(prompt))
	    .map(l => l.slice(prompt.length)) // (gdb) を除去
	    .map(l => l.trim())
    });
    return Array.from(new Set(list)); // uniq
    /*
      const command_list = data
      .filter  ((item: any) => item.type === key)
      .flatMap ((item: any) => item.commands);
      const command_set = Array.from (new Set (command_list));
      return command_set;
    */
}

function str2command_data(str: string) {
    let command_data: CommandData;
    const key = aliasMap[str];
    if (key != null && commandMap[key]) {
	command_data = commandMap[key];
    } else if (commandMap[str]) {
	command_data = commandMap[str];
    } else if (shellCommandMap[str]) {
	command_data = shellCommandMap[str];
    } else {
	abort(`map not found for ${str}`);
    }
    return command_data;
}

function command_data2md(key: string, command_data: CommandData) {
    const tr_list_md = command_data.usage.map(([cmd, desc]) => {
	return `|\`${cmd}\`|${desc}|`
    }).join("\n");
    console.log("tr_list_md = " + tr_list_md);
    const md = new vscode.MarkdownString(`
### \`${key}\` (\`${command_data.abbr}\`): ${command_data.exp} 
---
|コマンド使用例|説明|
|--|--|
${tr_list_md}
---
[関連リンク](${command_data.url})`
					);
    return md;
}

async function fold_answer(editor: vscode.NotebookEditor) {
    // 解答セルを折りたたむ（解答セルは１つだけという前提）
    console.log("fold_answer called");

    const notebook = editor.notebook;

    let i = 0, start = 0;
    for (const cell of notebook.getCells()) {
	const line = cell.document.getText();
	// console.log (i + ": " + line);
	if (line.match("#.*答")) {
	    // console.log ("matched line (" + i + ") = " + line);
	    start = i;
	    break;
	}
	i++;
    }
    // await vscode.window.showNotebookDocument (notebook);
    // await vscode.commands.executeCommand ("notebook.cell.quitEdit");
    // notebook.fold には引数は無く，事前に折りたたむセクションを含む
    // マークダウンセルを選択しておく必要がある．
    await new Promise(r => setTimeout(r, 500));
    const range = new vscode.NotebookRange(start, start + 1);
    editor.selection = range;
    editor.revealRange(range, vscode.NotebookEditorRevealType.Default);
    await new Promise(r => setTimeout(r, 50));
    await vscode.commands.executeCommand("notebook.fold");
    const range = new vscode.NotebookRange (0, 1);
    editor.selection = range;
}

// ****************************************************************

export async function activate(context: vscode.ExtensionContext) {
    console.log('your extension "gdb-notebook" is now active!');
    vscode.window.showInformationMessage('拡張機能gdb-notebookを起動しました');

    gdbcodelens_provider = new GdbCodeLensProvider();

    extension_context = context;

    // ゴミとして残っているターミナルを最初に閉じておく
    console.log("terminals = " + vscode.window.terminals);
    vscode.window.terminals.forEach(terminal => {
	console.log("terminal.name = |" + terminal.name + "|");
	console.log('creationOptions:', terminal.creationOptions);
	console.log('creationOptions.name:', terminal.creationOptions.name);
	if (terminal.name.startsWith("GDBNB")) {
	    terminal.dispose();
	}
    });


    // ./grammar.json から，aliasMap, commandMap を取得する
    // const grammar_json_path = context.asAbsolutePath ("./out/grammar.json")
    const grammar_json_path = vscode.Uri.joinPath(context.extensionUri, "./out/grammar.json").fsPath;
    console.log(grammar_json_path);
    const grammar_json = fs.readFileSync(grammar_json_path, "utf-8");
    const grammar_data = JSON5.parse(grammar_json)
    aliasMap = grammar_data.gdb_command.aliasMap;
    commandMap = grammar_data.gdb_command.commandMap;
    shellCommandMap = grammar_data.shell_command.commandMap;
    // console.log (JSON.stringify (shellCommandMap, null, 2));

    context.subscriptions.push(
	vscode.commands.registerCommand('gdb-notebook.helloWorld', () => {
	    vscode.window.showInformationMessage('Hello from gdb-notebook!');
	})
    );

    context.subscriptions.push(
	vscode.commands.registerCommand('gdb-notebook.reopenGDBNBFile', () => {
	    reopenGDBNBFile();
	})
    );

    context.subscriptions.push(
	vscode.workspace.registerNotebookSerializer(
	    "gdb-notebook", new GdbSerializer(), { transientOutputs: false }
	)
    );

    controller = vscode.notebooks.createNotebookController(
	"gdb-controller", "gdb-notebook", "Gdb Controller");
    controller.supportedLanguages = ["code", "markdown", "shellscript", "gdb_command"];
    controller.executeHandler = async (cells, notebook) => {
	// ターミナルがなければまず作る
	getOrCreateTerminal(notebook);

	for (const cell of cells) {
	    const execution = controller.createNotebookCellExecution(cell);
	    execution.start();

	    // Markdownセルはスキップ
	    if (cell.kind !== vscode.NotebookCellKind.Code) {
		execution.end(true);
		continue;
	    }

	    // console.log ("languageId = " + cell.document.languageId + ", " + cell.document.getText ());

	    // セル内容をターミナルに送信
	    const commands = cell.document.getText().split("\n");
	    for (const cmd of commands) {
		let line = cmd.trimStart();
		if (line === "") continue; // 空行は飛ばす
		if (line.startsWith("#")) continue; // コメント行も飛ばす

		// 先頭の "(gdb) " や "$ " を削除してから送信
		if (line.startsWith("(gdb)")) {
		    line = line.slice("(gdb)".length).trimStart();
		} else if (line.startsWith("$")) {
		    line = line.slice("$".length).trimStart();
		}
		const term = getOrCreateTerminal(notebook);
		term.sendText(line);

		// 少し待つ
		await new Promise(resolve => setTimeout (resolve, 500));
	    }

	    // ターミナル送信したのでセルは「完了」にする
	    execution.replaceOutput([
		new vscode.NotebookCellOutput([
		    vscode.NotebookCellOutputItem.text(
			`[${executionCounter}] ` + "GDBNBターミナルにコマンド送信済み"
		    )
		])
	    ]);
	    executionCounter++;

	    execution.end(true);
	}
    };
    context.subscriptions.push(controller);

    context.subscriptions.push(
	vscode.workspace.onDidOpenNotebookDocument(async (notebook) => {
	    if (notebook.notebookType !== "gdb-notebook") { return; }
	    getOrCreateTerminal(notebook);


	    // フォルダをワークスペースとして開く
	    /*
	      const uri = vscode.Uri.file (path.dirname (notebook.uri.fsPath));
	      console.log (uri);
	      await vscode.commands.executeCommand ("vscode.openFolder", uri, false);
	    */

	    /*
	    // GDBNBヒント表示
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
	    
	    panel.webview.onDidReceiveMessage (msg => {
	    if (msg.command === "send")  { console.log ("send"); }
	    if (msg.command === "close") { console.log ("close"); }
	    panel.dispose(); // 送信後閉じる
	    });
	    // ======================
	    */
	})
    );

    context.subscriptions.push(
	vscode.window.onDidCloseTerminal(closed => {
	    for (const [key, term] of terminalMap.entries()) {
		if (term === closed) {
		    terminalMap.delete(key);
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

	    // vscode.window.showInformationMessage ('onDidChangeActiveNotebookEditor');
	    const notebook = editor.notebook;
	    // 対応するGDBNBターミナルを表示する
	    const term = getOrCreateTerminal (notebook);
	    if (term) { term.show (); }
	    fold_answer (editor);
	})
    );

    /*
    // めっちゃ頻繁に呼ばれるので，なるべく使わない
    context.subscriptions.push (
    vscode.workspace.onDidChangeNotebookDocument (async editor => {
    console.log ("some cells changed");
    })
    );
    */

    context.subscriptions.push(
	vscode.languages.registerCodeLensProvider(
	    [
		{ language: "gdb_command", scheme: "vscode-notebook-cell" },
		{ language: "shellscript", scheme: "vscode-notebook-cell" }
	    ],
	    gdbcodelens_provider
	)
    );

    context.subscriptions.push(
	vscode.commands.registerCommand(
	    "gdb-notebook.showLink",
	    (cmd: string) => {
		const url = vscode.Uri.parse('https://gondow.github.io/linux-x86-64-programming/10-gdb.html#%E5%A4%89%E6%95%B0%E3%81%AE%E5%80%A4%E3%82%92%E8%A1%A8%E7%A4%BA-print');
		vscode.env.openExternal(url);
		// vscode.window.showInformationMessage (cmd, "OK");
	    }
	)
    );

    context.subscriptions.push(
	vscode.commands.registerCommand(
	    "gdb-notebook.showHelp",
	    (key: string, command_data: CommandData) => { helpProvider.showHelp(key, command_data); }
	)
    );

    context.subscriptions.push(
	vscode.commands.registerCommand(
	    "gdb-notebook.toggleCellType",
	    async (doc: vscode.TextDocument) => {
		const newLang = doc.languageId === "gdb_command" ? "shellscript" : "gdb_command";
		await vscode.languages.setTextDocumentLanguage(doc, newLang);
	    }
	)
    );

    context.subscriptions.push(
	vscode.commands.registerCommand(
	    "gdb-notebook.toggleCopilotCompletion",
	    async (enabled: boolean) => {
		await vscode.workspace.getConfiguration().update(
		    "github.copilot.enable",
		    { "*": !enabled },
		    vscode.ConfigurationTarget.Workspace
		);
		// 変更がGUI上，すぐに反映されないことがあるので
		gdbcodelens_provider.refresh();
	    }
	)
    );

    context.subscriptions.push(
	vscode.commands.registerCommand(
	    "gdb-notebook.cycleSmartCompletion",
	    async () => {
		smart_completion_mode = (smart_completion_mode + 1) % 3;
		gdbcodelens_provider.refresh();
	    }
	)
    );

    registerGdbHover(context);

    helpProvider = new CommandHelpViewProvider();
    context.subscriptions.push(
	vscode.window.registerWebviewViewProvider("commandHelpView", helpProvider)
    );

    // =======================
    const provider = new CommandTreeDataProvider();
    vscode.window.createTreeView("commandTreeView", {
	treeDataProvider: provider
    });
    provider._onDidChangeTreeData.fire(undefined);

    context.subscriptions.push(
	vscode.commands.registerCommand("example.quickpick", async () => {
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

    // console.log ("!!!!!!!! hogehoge");
    // =======================
    /*
      try {
      const example_dir = vscode.Uri.joinPath (context.extensionUri, "examples");
      const example_file = vscode.Uri.joinPath (example_dir, "test.gdbnb");
      const config = vscode.workspace.getConfiguration ("gdbNotebook");
      const autoOpenSampleFolder = config.get<boolean> ("autoOpenSampleFolder", false);
      // console.log ("autoOpenSampleFolder = " + autoOpenSampleFolder);
      
      if (true || autoOpenSampleFolder) {
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
    */

    context.subscriptions.push(
	vscode.languages.registerCompletionItemProvider(
	    "gdb_command",
	    {
		provideCompletionItems: (document, position, token, context) => {
		    const line = document.lineAt(position).text;
		    if (!line.startsWith("(gdb)")) return;

		    const tokens = line.match(/[^\/\s]+|\/[^\s]*/g);
		    if (tokens == null) return [];

		    // console.log ("tokens = " + tokens);

		    if (smart_completion_mode == 0 || smart_completion_mode == 1) {
			const notebook = vscode.window.activeNotebookEditor?.notebook;
			if (!notebook) return;

			console.log("!!!!!!");
			const commands: string[] = notebook.metadata.gdb_command_set;
			const keys = commands.map(cmd => cmd.trim().split(/\s+/)[0]);
			console.log("commands: " + commands);
			console.log("keys: " + keys);
			return Object.entries(commandMap)
			    .filter(([key, cmd]) => keys.includes(key))
			    .sort(([a], [b]) => a.localeCompare(b))
			    .map(([key, cmd]) => {
				const long = commands.filter(s => s.startsWith(key))[0] ?? key;
				const item = new vscode.CompletionItem(
				    {
					label: smart_completion_mode == 0 ? long : key,
					description: cmd.exp
				    },
				    vscode.CompletionItemKind.Keyword);
				item.detail = `(${cmd.abbr}) ` + cmd.exp;
				item.documentation = new vscode.MarkdownString(
				    "|使用例|説明|\n|--|--|\n" +
					cmd.usage.map(([cmd, desc]) => {
					    return `|\`${cmd}\`|${desc}|`
					}).join("\n"));
				return item;
			    });
		    }

		    // メインコマンドの補完候補を出力
		    if (tokens.length <= 1) {
			return Object.entries(commandMap)
			    .sort(([a], [b]) => a.localeCompare(b))
			    .map(([key, cmd]) => {
				const item = new vscode.CompletionItem(
				    { label: key, description: cmd.exp },
				    vscode.CompletionItemKind.Keyword);
				item.detail = `(${cmd.abbr}) ` + cmd.exp;
				item.documentation = new vscode.MarkdownString(
				    "|使用例|説明|\n|--|--|\n" +
					cmd.usage.map(([cmd, desc]) => {
					    return `|\`${cmd}\`|${desc}|`
					}).join("\n"));
				return item;
			    });
		    }
		    // サブコマンドの補完候補を出力
		    if (tokens.length == 2) {
			const key = aliasMap[tokens[1]!] ?? tokens[1]!;
			const command = commandMap[key];
			if (command == null || command.subcommands == null) return [];
			return Object.entries(command.subcommands)
			    .sort(([a], [b]) => a.localeCompare(b))
			    .map(([key, cmd]) => {
				const item = new vscode.CompletionItem(
				    { label: key, description: cmd.exp },
				    vscode.CompletionItemKind.Keyword);
				item.detail = `(${cmd.abbr}) ` + cmd.exp;
				item.documentation = new vscode.MarkdownString(
				    "|使用例|説明|\n|--|--|\n" +
					cmd.usage.map(([cmd, desc]) => {
					    return `|\`${cmd}\`|${desc}|`
					}).join("\n"));
				return item;
			    });
		    }
		    // メインコマンドのオプションの補完候補を出力
		    if (context.triggerCharacter === "/"
			&& tokens.length == 3
			&& tokens[2]!.startsWith("/")) {
			if (tokens[1] === "x") {
			    const item = new vscode.CompletionItem("Nfu", vscode.CompletionItemKind.Snippet);
			    item.insertText = new vscode.SnippetString("${1:N}${2:f}${3:u}");
			    item.filterText = "0 1 2 3 4 5 6 7 8 9 a c d f i o s t u x z b h w g N";
			    item.documentation = new vscode.MarkdownString(
				`
* N: 個数
* f: 表示形式 (format)
  - a (アドレス)
  - c (文字)
  - d (符号あり10進数)
  - f (浮動小数点数)
  - i (機械語命令)
  - o (8進数)
  - s (文字列)
  - t (2進数)
  - u (符号なし10進数)
  - x (16進数)
  - z (16進数・上位バイトのゼロも表示)
* u: 単位 (unit)
  - b (1バイト，byte)
  - h (2バイト，half-word)
  - w (4バイト，word)
  - g (8バイト，giant)
`
			    );

			    item.label = "/Nfu";
			    console.log("x: " + tokens[2]);
			    return [item];
			} else {
			    const key = aliasMap[tokens[1]!] ?? tokens[1]!;
			    const command = commandMap[key];
			    if (command == null || command.options == null) return [];

			    return Object.entries(command.options)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, cmd]) => {
				    const item = new vscode.CompletionItem(
					{ label: key, description: cmd.exp },
					vscode.CompletionItemKind.Keyword);
				    item.detail = cmd.exp;
				    item.documentation = new vscode.MarkdownString(
					"|使用例|説明|\n|--|--|\n" +
					    cmd.usage.map(([cmd, desc]) => {
						return `|\`${cmd}\`|${desc}|`
					    }).join("\n"));
				    return item;
				});
			}
		    }
		}
	    },
	    " ", "/" // トリガー文字
	)
    );

    context.subscriptions.push(
	vscode.languages.registerCompletionItemProvider(
	    "shellscript",
	    {
		provideCompletionItems: (document, position, token, context) => {
		    const line = document.lineAt(position).text;
		    if (!line.startsWith("$")) return [];

		    const tokens = line.match(/[^\s]+/g);
		    if (tokens == null || tokens.length >= 2) return [];

		    console.log("tokens = " + tokens);
		    console.log("mode = " + smart_completion_mode);

		    if (smart_completion_mode == 0 || smart_completion_mode == 1) {
			const notebook = vscode.window.activeNotebookEditor?.notebook;
			if (!notebook) return;
			const commands: string[] = notebook.metadata.shell_command_set;
			const keys = commands.map(cmd => cmd.trim().split(/\s+/)[0]);
			console.log("commands: " + commands);
			console.log("keys: " + keys);
			return Object.entries(shellCommandMap)
			    .filter(([key, cmd]) => keys.includes(key))
			    .sort(([a], [b]) => a.localeCompare(b))
			    .map(([key, cmd]) => {
				const long = commands.filter(s => s.startsWith(key))[0] ?? key;
				const item = new vscode.CompletionItem(
				    {
					label: smart_completion_mode == 0 ? long : key,
					description: cmd.exp
				    },
				    vscode.CompletionItemKind.Keyword);
				item.detail = cmd.exp;
				item.documentation = new vscode.MarkdownString(
				    "|使用例|説明|\n|--|--|\n" +
					cmd.usage.map(([cmd, desc]) => {
					    return `|\`${cmd}\`|${desc}|`
					}).join("\n"));
				return item;
			    });
		    }
		    // コマンドの補完候補を出力
		    return Object.entries(shellCommandMap)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, cmd]) => {
			    const item = new vscode.CompletionItem(
				{ label: key, description: cmd.exp },
				vscode.CompletionItemKind.Keyword);
			    item.detail = cmd.exp;
			    item.documentation = new vscode.MarkdownString(
				"|使用例|説明|\n|--|--|\n" +
				    cmd.usage.map(([cmd, desc]) => {
					return `|\`${cmd}\`|${desc}|`
				    }).join("\n"));
			    return item;
			});
		}
	    },
	    " " // トリガー文字
	)
    );
}

export function deactivate() {
    vscode.window.showInformationMessage('Deactivated');

    vscode.window.terminals.forEach(terminal => { terminal.dispose(); });
}

function closeTerminal(nb: vscode.NotebookDocument) {
    const key = nb.uri.toString();
    const term = terminalMap.get(key);
    if (term) {
	term.dispose();
	terminalMap.delete(key);
    }
}

function getOrCreateTerminal(nb: vscode.NotebookDocument): vscode.Terminal {
    const key = nb.uri.toString();
    let term = terminalMap.get(key);
    const cwd = nb.uri.fsPath ? path.dirname(nb.uri.fsPath) : extension_context.extensionUri.fsPath;
    if (!term) {
	term = vscode.window.createTerminal({
	    name: `GDBNB: ${nb.uri.path.split('/').pop()}`,
	    cwd: cwd
	});
	term.show();
	terminalMap.set(key, term);
    }
    return term;
}

async function reopenGDBNBFile() {
    const editor = vscode.window.activeNotebookEditor;
    const nb = editor?.notebook;

    if (!nb) return;

    const uri = nb.uri;

    closeTerminal(nb);
    await vscode.commands.executeCommand('notebook.clearAllCellsOutputs');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    await new Promise(resolve => setTimeout(resolve, 200));
    await vscode.commands.executeCommand('vscode.openWith', uri, 'gdb-notebook');
}

class GdbSerializer implements vscode.NotebookSerializer {
    // 読み込み
    async deserializeNotebook(content: Uint8Array) {
	const text = new TextDecoder().decode(content);
	let raw: any;
	try {
	    raw = JSON.parse(text);
	} catch (e) {
	    console.error(e);
	}

	const cells = raw.cells.map((item: any) => {
	    const kind = (item.kind === "code"
			  ? vscode.NotebookCellKind.Code
			  : vscode.NotebookCellKind.Markup);
	    const new_cell = new vscode.NotebookCellData(kind, item.value, item.languageId);
	    new_cell.languageId = item.languageId;
	    return new_cell;
	});
	const notebookData = new vscode.NotebookData(cells);

	// 解答情報を抽出
	let i = 0, start = 0, answer_found = false;
	let shell_command_list: string[] = [];
	let gdb_command_list: string[] = [];
	for (const item of raw.cells) {
	    // console.log (i + ": " + item.kind + ", " + item.value);
	    // 「#.*答」を含むマークダウンより後の連続コードセルを解答として収集
	    if (item.value.match("#.*答")) {
		// console.log ("matched line (" + i + ") = " + item.value);
		answer_found = true;
	    } else if (answer_found) {
		if (item.kind === "code") {
		    // console.log ("answer (" + i + ") = " + item.value);
		    if (item.languageId === "shellscript") {
			shell_command_list.push(item.value);
		    } else if (item.languageId === "gdb_command") {
			gdb_command_list.push(item.value);
		    } else {
			console.error("unknown languageId: " + item.languageId);
			throw new Error("unknown languageId: " + item.languageId);
		    }
		} else {
		    break;
		}
	    }
	    i++;
	}
	// console.log ("shell_command_list: " + shell_command_list);
	// console.log ("gdb_command_list: " + gdb_command_list);
	const shell_command_set = extract_set("shellscript", shell_command_list);
	const gdb_command_set = extract_set("gdb_command", gdb_command_list);
	// console.log ("shell_command_set : " + shell_command_set);
	// console.log ("gdb_command_set : " + gdb_command_set);

	notebookData.metadata = {
	    shell_command_set: shell_command_set,
	    gdb_command_set: gdb_command_set
	};
	return notebookData;
    }

    // 書き込み
    async serializeNotebook(data: vscode.NotebookData) {
	const cells = data.cells.map(cell => ({
	    kind: (cell.kind === vscode.NotebookCellKind.Code
		   ? "code" : "markdown"),
	    value: cell.value,
	    languageId: cell.languageId
	}));

	/*	
		const metadata_copy = { ...(data.metadata ?? {}) };
		delete metadata_copy.shell_command_set;
		delete metadata_copy.gdb_command_set;
		const data2 = {
		metadata: metadata_copy,
		cells
		};
		console.log ("data.metadata = " + data.metadata);
	*/
	const json = JSON.stringify({ cells: cells }, null, 2);

	return new TextEncoder().encode(json);
    }
}

function registerGdbHover(context: vscode.ExtensionContext) {

    context.subscriptions.push(
	vscode.languages.registerHoverProvider(
	    { scheme: 'vscode-notebook-cell', language: 'gdb_command' },
	    {
		provideHover(document, position, token) {
		    const range = document.getWordRangeAtPosition(position);
		    if (!range) return;
		    const word = document.getText(range);
		    const key = aliasMap[word] ?? word;
		    const command_data = commandMap[key];
		    if (command_data != null) {
			const md = command_data2md(key, command_data);
			return new vscode.Hover(md, range);
		    }
		}
	    }
	)
    );

    context.subscriptions.push(
	vscode.languages.registerHoverProvider(
	    { scheme: 'vscode-notebook-cell', language: 'shellscript' },
	    {
		provideHover(document, position, token) {
		    const range = document.getWordRangeAtPosition(position);
		    if (!range) return;
		    const word = document.getText(range);
		    const text = shellCommandMap[word]!.exp;
		    // console.log ("shellCommandMap [word] = " + text);
		    if (text) { return new vscode.Hover(text, range); }
		}
	    }
	)
    );

    /*
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
    */
}

// ****************************************************************
class GdbCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    refresh() {
	this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
	// console.log ("CodeLens called");
	// console.log ("language:", document.languageId);
	// console.log ("scheme:", document.uri.scheme);

	const gdb_alias_keys = Object.keys(aliasMap);
	const gdb_canon_keys = Object.keys(commandMap);
	const shell_command_keys = Object.keys(shellCommandMap);

	const lenses: vscode.CodeLens[] = [];

	const cell_type = document.languageId === "gdb_command" ? "GDB command" : "Shell Script";

	const config = vscode.workspace.getConfiguration();
	const copilot_enable = config.get<CopilotEnable>("github.copilot.enable");
	const copilot_enable_bool = typeof copilot_enable === "boolean"
	      ? copilot_enable : (copilot_enable?.["*"] ?? false);

	lenses.push(new vscode.CodeLens(
	    new vscode.Range(0, 0, 0, 0),
	    {
		title: `セル言語の切替（今は${cell_type}）`,
		command: "gdb-notebook.toggleCellType",
		arguments: [document]
	    }
	));

	lenses.push(new vscode.CodeLens(
	    new vscode.Range(0, 0, 0, 0),
	    {
		title: `Copilot補完の切替（今は${copilot_enable_bool ? "ON" : "OFF"}）`,
		command: "gdb-notebook.toggleCopilotCompletion",
		arguments: [copilot_enable_bool]
	    }
	));

	lenses.push(new vscode.CodeLens(
	    new vscode.Range(0, 0, 0, 0),
	    {
		title: `補完候補の切替（今は${smart_completion_mode == 0 ? "LONG" : smart_completion_mode == 1 ? "SHORT" : "ALL"}）`,
		command: "gdb-notebook.cycleSmartCompletion",
		arguments: []
	    }
	));

	outer_loop:
	for (let i = 0; i < document.lineCount; i++) {
	    const line = document.lineAt(i);
	    const text = line.text.trim();
	    // console.log ("======:" + line.text);
	    // コマンドは（トリム後の）行頭に限定（高速化のため）
	    // break-if だけ特別処理
	    for (let key of gdb_alias_keys) {
		let alias_line = text;
		if (alias_line.startsWith("(gdb)")) {
		    alias_line = alias_line.slice("(gdb)".length).trimStart();
		}
		// console.log ("alias_line: " + alias_line);
		if (alias_line.match("^" + key + "\\b")) {
		    const range = new vscode.Range(i, 0, i, 0);
		    // break-if だけ特別扱い
		    if (alias_line.match("\\bif\\b")) {
			key = "if";
			// console.log ("********************: " + key);
		    }
		    // console.log ("alias matched: " + line.text + ", " + key);
		    const cmd = access(commandMap, access(aliasMap, key));
		    lenses.push(new vscode.CodeLens(range, {
			title: "説明",
			command: "gdb-notebook.showHelp",
			arguments: [key, cmd]
		    }));
		    lenses.push(new vscode.CodeLens(range, {
			title: "関連リンク",
			command: "gdb-notebook.showLink",
			arguments: [access(cmd, "url")]
		    }));

		    continue outer_loop;
		}
	    }

	    for (let key of gdb_canon_keys) {
		let canon_line = text;
		if (canon_line.startsWith("(gdb)")) {
		    canon_line = canon_line.slice("(gdb)".length).trimStart();
		}
		if (canon_line.match("^" + key + "\\b")) {
		    const range = new vscode.Range(i, 0, i, 0);
		    // break-if だけ特別扱い
		    if (canon_line.match("\\bif\\b")) { key = "if"; }
		    // console.log ("canon matched: " + line.text + ", " + key);
		    const cmd = access(commandMap, key);
		    lenses.push(new vscode.CodeLens(range, {
			title: "説明",
			command: "gdb-notebook.showHelp",
			arguments: [key, cmd]
		    }));
		    lenses.push(new vscode.CodeLens(range, {
			title: "関連リンク",
			command: "gdb-notebook.showLink",
			arguments: [access(cmd, "url")]
		    }));

		    continue outer_loop;
		}
	    }

	    // console.log (shell_command_keys);
	    for (const key of shell_command_keys) {
		let shell_line = text;
		if (shell_line.startsWith("$")) {
		    shell_line = shell_line.slice("$".length).trimStart();
		}
		if (shell_line.match("^" + key + "\\b")) {
		    // console.log ("shell matched: " + line.text + ", " + key);
		    const range = new vscode.Range(i, 0, i, 0);
		    const cmd = access(shellCommandMap, key);
		    lenses.push(new vscode.CodeLens(range, {
			title: "説明",
			command: "gdb-notebook.showHelp",
			arguments: [key, cmd]
		    }));
		    lenses.push(new vscode.CodeLens(range, {
			title: "関連リンク",
			command: "gdb-notebook.showLink",
			arguments: [access(cmd, "url")]
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

    async resolveWebviewView(view: vscode.WebviewView) {
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

    async showHelp(key: string, command_data: CommandData) {
	if (!this.view) {
	    await vscode.commands.executeCommand("commandHelpView.focus");
	    await new Promise(resolve => setTimeout(resolve, 50));
	}
	if (this.view) {
	    // this.view.webview.html = `<pre>${text}</pre>`;
	    const tr_list_html = command_data.usage.map(([cmd, desc]) => {
		return `<tr><td><code>${cmd}</code></td><td>${desc}</td></tr>`
	    }).join("\n");
	    console.log(tr_list_html);
	    const abbr = command_data.abbr ? `(<code>${command_data.abbr}</code>)` : "";
	    console.log("!!!!: " + abbr);
	    this.view.webview.html = `<html>
<h3> <code>${key}</code> ${abbr}: ${command_data.exp} </h3>
<hr/>
<table border="1">
  <thead> <tr> <th>コマンド使用例</th> <th>説明</th> </tr> </thead>
  <tbody> ${tr_list_html} </tbody>
</table>
<hr/>
<a href=${command_data.url}>関連リンク</a>
</html>`;

	    await vscode.commands.executeCommand("commandHelpView.focus");
	}
    }
}

class CommandTreeItem extends vscode.TreeItem {
    public readonly label: string;
    constructor(label: string, has_map: boolean, is_leaf: boolean) {
	if (is_leaf) {
	    super(label, vscode.TreeItemCollapsibleState.None);
	} else {
	    super(label, vscode.TreeItemCollapsibleState.Collapsed);
	}
	this.label = label;

	if (has_map) {
	    const command_data = str2command_data(label);
	    this.tooltip = command_data2md(label, command_data);
	}
    }
}

class CommandTreeDataProvider implements vscode.TreeDataProvider<CommandTreeItem> {

    public _onDidChangeTreeData = new vscode.EventEmitter<CommandTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem(element: CommandTreeItem): vscode.TreeItem {
	return element;
    }

    getChildren(element?: CommandTreeItem): CommandTreeItem[] {
	if (!element) {
	    return [
		new CommandTreeItem("GDBNBの使い方", false, false),
		new CommandTreeItem("シェルコマンド", false, false),
		new CommandTreeItem("GDBコマンド", false, false)
	    ];
	}

	if (element.label === "GDBコマンド") {
	    return Object.entries(commandMap)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, cmd]) => {
		    return new CommandTreeItem(key, true, true);
		});
	} else if (element.label === "シェルコマンド") {
	    return Object.entries(shellCommandMap)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, cmd]) => {
		    return new CommandTreeItem(key, true, true);
		});
	}

	return [];
    }
}
// ****************************************************************
/*
  Todo:
*/
