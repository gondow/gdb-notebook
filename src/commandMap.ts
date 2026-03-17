type CommandData = {
     exp:   string; // 説明文
     usage: string; // 使用例
     url:   string; // 関連URL
};

// alias -> canonical
// ヒットしない場合は，commandMap を引く
export const aliasMap: Record<string, string> = {
    "b": "break",
    "r": "run",
};

// 条件付きブレークだけは"break"でマッチした後に特別扱いする
export const commandMap: Record<string, CommandData> = {
    "break": {
	exp: "ブレークポイントを設定する",
	usage: `b main         # main関数でブレーク
b file.c:10    # ファイルfile.cの10行目でブレーク\n
b 42           # （現在のファイルの）42行目でブレーク`,
	url: "https://gondow.github.io/linux-x86-64-programming/10-gdb.html#%E5%A4%89%E6%95%B0%E3%81%AE%E5%80%A4%E3%82%92%E8%A1%A8%E7%A4%BA-print"
    },
};
