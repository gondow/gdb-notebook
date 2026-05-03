## サンプルのノートブック

以下はこのVSCode拡張内に同梱しているサンプルのノートブックです．
これを順番に学ぶことで，gdbの使い方を学べます．

### 基本操作

|ファイル名|内容|
|--|--|
|[`1-1-run-quit.gdbnb`](1-1-run-quit.gdbnb)|デバッグオプション付きでコンパイルし，gdb上で`a.out`を実行する|
|[`1-2-break1.gdbnb`](1-2-break1.gdbnb)|`break`で関数名を指定してブレークする|
|[`1-2-break2.gdbnb`](1-2-break2.gdbnb)|`break`で行番号を指定してブレークする|
|[`1-2-break3.gdbnb`](1-2-break3.gdbnb)|ブレークポイントを設定し，繰り返し`continue`する|
|[`1-3-print1.gdbnb`](1-3-print1.gdbnb)|`print`で変数の値を表示する|
|[`1-3-print2.gdbnb`](1-3-print2.gdbnb)|`print`で式の値を表示する|
|[`1-4-step.gdbnb`](1-4-step.gdbnb)|`step`でステップ実行する|
|[`1-5-display.gdbnb`](1-5-display.gdbnb)|`display`で変数の値を自動表示する|
|[`1-6-argv.gdbnb`](1-6-argv.gdbnb)|コマンドライン引数を与えて実行する|
|[`1-7-redirection.gdbnb`](1-7-redirection.gdbnb)|標準入出力を切り替えて実行する|

### ステップ実行

|ファイル名|内容|
|--|--|
|[`2-1-step.gdbnb`](2-1-step.gdbnb)|`step`でステップ実行する（関数の中に入る）|
|[`2-2-next.gdbnb`](2-2-next.gdbnb)|`next`でステップ実行する（関数をまたぐ）|
|[`2-3-finish.gdbnb`](2-3-finish.gdbnb)|`finish`でステップ実行する（関数をまたぐ）|
|[`2-4-until.gdbnb`](2-4-until.gdbnb)|`until`でループの直後まで実行する|

### ブレークポイントとウォッチポイント

|ファイル名|内容|
|--|--|
|[`3-1-break.gdbnb`](3-1-break.gdbnb)|ブレークポイントの確認や有効化・無効化を行う|
|[`3-2-if.gdbnb`](3-2-if.gdbnb)|`break if`で条件付きブレークポイントを設定する|
|[`3-3-commands.gdbnb`](3-3-commands.gdbnb)|`commands`でブレークした時に自動実行するコマンド列を指定する|
|[`3-4-watch.gdbnb`](3-4-watch.gdbnb)|`watch`で変数への書き込みを監視する|
|[`3-5-tbreak.gdbnb`](3-5-tbreak.gdbnb)|`tbreak`で一時的なブレークポイントを設定する|
|[`3-6-rbreak.gdbnb`](3-6-rbreak.gdbnb)|`rbreak`で正規表現にマッチするすべての関数にブレークポイントを設定する|


### 実行状態（変数）の観察

|ファイル名|内容|
|--|--|
|[`4-1-struct.gdbnb`](4-1-struct.gdbnb)|`print`で構造体の値を表示する|
|[`4-2-format.gdbnb`](4-2-format.gdbnb)|`print`で出力フォーマットを指定する|
|[`4-3-union.gdbnb`](4-3-union.gdbnb)|`print`で共用体の値を表示する|
|[`4-4-array.gdbnb`](4-4-array.gdbnb)|`print`で配列の値を表示する（`@`を使う）|
|[`4-5-scope.gdbnb`](4-5-scope.gdbnb)|`::`でスコープを指定する|
|[`4-6-printf.gdbnb`](4-6-printf.gdbnb)|`printf`でC言語のprintf風の表示をする|
|[`4-7-dprintf.gdbnb`](4-7-dprintf.gdbnb)|`dprintf`で動的なprintfを設定する|


### 関数の呼び出しとスタック

|ファイル名|内容|
|--|--|
|[`5-1-backtrace.gdbnb`](5-1-backtrace.gdbnb)|`backtrace`でバックトレースを表示する|
|[`5-2-up-down-frame.gdbnb`](5-2-up-down-frame.gdbnb)|`up`，`down`，`frame`で注目するスタックフレームを変更する|
|[`5-3-info-locals.gdbnb`](5-3-info-locals.gdbnb)|`info locals`や`info args`で局所変数や引数の値を一括表示する|


### 実行状態の変更

|ファイル名|内容|
|--|--|
|[`6-1-assignment.gdbnb`](6-1-assignment.gdbnb)|`print`で変数の値を変更する|
|[`6-2-infinite-loop.gdbnb`](6-2-infinite-loop.gdbnb)|変数の値を変更して，無限ループから脱出する|
|[`6-3-side-effect.gdbnb`](6-3-side-effect.gdbnb)|副作用を持つ関数を呼び出して，実行状態を変更する|
|[`6-4-jump.gdbnb`](6-4-jump.gdbnb)|`jump`を使って，無限ループから脱出する|
|[`6-5-return.gdbnb`](6-5-return.gdbnb)|`return`を使って，関数の返り値を変更する|
|[`6-6-compile.gdbnb`](6-6-compile.gdbnb)|`compile code`を使って，プログラムを埋め込む|


### 型

|ファイル名|内容|
|--|--|
|[`7-1-whatis1.gdbnb`](7-1-whatis1.gdbnb)|`whatis`で型を素早く知る(1)|
|[`7-1-whatis2.gdbnb`](7-1-whatis2.gdbnb)|`whatis`で型を素早く知る(2)|
|[`7-2-ptype.gdbnb`](7-2-ptype.gdbnb)|`ptype`で型の詳細を知る|

### アセンブリ言語レベルのデバッグ

|ファイル名|内容|
|--|--|
|[`8-1-break-byaddr.gdbnb`](8-1-break-byaddr.gdbnb)|アドレス指定でブレークする|
|[`8-2-stepi-nexti.gdbnb`](8-2-stepi-nexti.gdbnb)|`stepi`と`nexti`で，機械語命令単位でステップ実行する|
|[`8-3-register.gdbnb`](8-3-register.gdbnb)|レジスタの値を読んだり書いたりする|
|[`8-4-x1-endian.gdbnb`](8-4-x1-endian.gdbnb)|`x`でリトルエンディアンでの格納を確認する|
|[`8-4-x2-pointer.gdbnb`](8-4-x2-pointer.gdbnb)|`x`でポインタと実体の違いを確認する|
|[`8-4-x3-array.gdbnb`](8-4-x3-array.gdbnb)|`x`で配列の中身を確認する|
|[`8-4-x4-struct.gdbnb`](8-4-x4-struct.gdbnb)|`x`で構造体の中身を確認する|
|[`8-4-x5-instruction.gdbnb`](8-4-x5-instruction.gdbnb)|`x`で機械語命令の中身を確認する|
|[`8-4-x6-frame.gdbnb`](8-4-x6-frame.gdbnb)|`x`でスタックフレームのレイアウトを確認する|
|[`8-4-x7-buffer-overflow.gdbnb`](8-4-x7-buffer-overflow.gdbnb)|`x`でバッファオーバーフローを確認する|
|[`8-5-find.gdbnb`](8-5-find.gdbnb)|`find`で特定の値をメモリ中から探す|
|[`8-6-info-symbol.gdbnb`](8-6-info-symbol.gdbnb)|`info symbol`，`info address`，`info line`でシンボルテーブル情報を確認する|

### ヘルプ，アプロポス，補完ユーザ定義コマンドを使ってみる

|ファイル名|内容|
|--|--|
|[`9-1-help.gdbnb`](9-1-help.gdbnb)|`help`でコマンドの説明を表示する|
|[`9-2-apropos.gdbnb`](9-2-apropos.gdbnb)|`apropos`で正規表現にマッチするコマンドを表示する|
|[`9-3-completion.gdbnb`](9-3-completion.gdbnb)|補完とコマンド履歴機能を使ってみる|
|[`9-4-user-defined.gdbnb`](9-4-user-defined.gdbnb)|ユーザ定義コマンドを使ってみる|


### メモリ関連のバグのデバッグ

- ここでは論理バグではなく，メモリ関連のバグを主に扱ってます．初心者にとって原因究明が難しいバグだからです．

|ファイル名|内容|
|--|--|
|[`10-1-segv.gdbnb`](10-1-segv.gdbnb)|segmentation fault (あるいは bus error)の原因を探る|
|[`10-2-lib-func.gdbnb`](10-2-lib-func.gdbnb)|ライブラリ関数中でクラッシュした原因を探る|
|[`10-3-uninit.gdbnb`](10-2-uninit.gdbnb)|未初期化変数の使用を探る|
|[`10-4-buf-overflow1-next-var.gdbnb`](10-4-buf-overflow1-next-var.gdbnb)|バッファオーバーフローで隣の変数の値が上書きされた|
|[`10-4-buf-overflow2-return-addr.gdbnb`](10-4-buf-overflow2-return-addr.gdbnb)|バッファオーバーフローでリターンアドレスと古い`%rbp`の値が上書きされた|

- 古い%rbpを上書きし，その後，ライブラリ関数を呼び出してクラッシュした原因を探る
  watch *(long*)$rbp
- ダングリングポインタ
- $rspのアラインメント違反 `movq $4, %rsp`
- 間違った longjmp


