const JSON5 = require ("json5")

// JSON5 なら，コメント，ケツカンマ，文字列中の改行などが許される
// https://www.tohoho-web.com/ex/json5.html

const fs    = require ("fs");
const path  = require ("path");

const json = fs.readFileSync ("./grammar.json");
const data = JSON5.parse (json)
// console.log (JSON.stringify (data, null, 2));

const gdb_alias_commands = Object.keys (data.gdb_command.aliasMap).join ("|");
const gdb_canon_commands = Object.keys (data.gdb_command.commandMap).join ("|");
const shell_commands = Object.keys (data.shell_command.commandMap).join ("|");
// console.log (gdb_alias_commands);
// console.log (gdb_canon_commands);
// console.log (shell_commands);

const gdb_tmGrammar_json = {
    "scopeName": "source.gdb",
    "patterns": [
	{
	    "match": "\\b(" + gdb_alias_commands + "|" + gdb_canon_commands + ")\\b",
	    "name": "keyword.control.gdb"
	},
	{
	    "match": "#.*$",
	    "name": "comment.line.number-sign.gdb"
	},
	{
	    "match": "^\\(gdb\\)|>",
	    "name": "support.function.gdb"
	}
    ]
};

fs.writeFileSync ("../gdb.tmGrammar.json", JSON.stringify (gdb_tmGrammar_json, null, 2), "utf8");

