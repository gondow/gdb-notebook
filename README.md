# gdb-notebook README

gdb-notebook は，gdbコマンドをVSCode上で対話的に（クリックするだけで）実行することで，
gdbの使い方を学んだり，記録するためのノートブック環境です．
（Pythonノートブックでは，gdbの対話的な実行が困難です）．

## 主な機能

- 上から順番に「セルの実行」を押すことで，シェルコマンド（例：`gcc`）や
gdbコマンド（例：`break main`）をターミナル上で実行できます．
- ターミナル上で，同じコマンドを手動で入力しても同じ実行ができます．
  （ここに図を入れる）
- ツールチップ，コードレンズ，コード補完などで，コマンドの説明を見れます．

## サンプルのノートブック

以下はこのVSCode拡張内に同梱しているサンプルのノートブックです．
これを順番に学ぶことで，gdbの使い方を学べます．

### 基本操作

|ファイル名|内容|
|--|--|
|[`1-1-run-quit.gdbnb`](./examples/1-1-run-quit.gdbnb)|デバッグオプション付きでコンパイルし，gdb上で`a.out`を実行する|
|[`1-2-break1.gdbnb`](./examples/1-2-break1.gdbnb)|`break`で関数名を指定してブレークする|
|[`1-2-break2.gdbnb`](./examples/1-2-break2.gdbnb)|`break`で行番号を指定してブレークする|
|[`1-2-break3.gdbnb`](./examples/1-2-break3.gdbnb)|ブレークポイントを設定し，繰り返し`continue`する|
|[`1-3-print1.gdbnb`](./examples/1-3-print1.gdbnb)|`print`で変数の値を表示する|
|[`1-3-print2.gdbnb`](./examples/1-3-print2.gdbnb)|`print`で式の値を表示する|
|[`1-4-step.gdbnb`](./examples/1-4-step.gdbnb)|`step`でステップ実行する|
|[`1-5-display.gdbnb`](./examples/1-5-display.gdbnb)|`display`で変数の値を自動表示する|
|[`1-6-args.gdbnb`](./examples/1-6-args.gdbnb)|コマンドライン引数を与えて実行する|
|[`1-7-redirection.gdbnb`](./examples/1-7-redirection.gdbnb)|標準入出力を切り替えて実行する|

### ステップ実行

|ファイル名|内容|
|--|--|
|[`2-1-step.gdbnb`](./examples/2-1-step.gdbnb)|`step`でステップ実行する（関数の中に入る）|
|[`2-2-next.gdbnb`](./examples/2-2-next.gdbnb)|`next`でステップ実行する（関数をまたぐ）|
|[`2-3-finish.gdbnb`](./examples/2-3-finish.gdbnb)|`finish`でステップ実行する（関数をまたぐ）|
|[`2-4-until.gdbnb`](./examples/2-4-until.gdbnb)|`until`でループの直後まで実行する|

### ブレークポイントとウォッチポイント

|ファイル名|内容|
|--|--|
|[`3-1-break.gdbnb`](./examples/3-1-break.gdbnb)|ブレークポイントの確認や有効化・無効化を行う|
|[`3-2-if.gdbnb`](./examples/3-2-if.gdbnb)|`break if`で条件付きブレークポイントを設定する|
|[`3-3-commands.gdbnb`](./examples/3-3-commands.gdbnb)|`commands`でブレークした時に自動実行するコマンド列を指定する|
|[`3-4-watch.gdbnb`](./examples/3-4-watch.gdbnb)|`watch`で変数への書き込みを監視する|
|[`3-5-tbreak.gdbnb`](./examples/3-5-tbreak.gdbnb)|`tbreak`で一時的なブレークポイントを設定する|
|[`3-6-rbreak.gdbnb`](./examples/3-6-rbreak.gdbnb)|`rbreak`で正規表現にマッチするすべての関数にブレークポイントを設定する|


### 実行状態（変数）の観察

|ファイル名|内容|
|--|--|
|[`4-1-struct.gdbnb`](./examples/4-1-struct.gdbnb)|`print`で構造体の値を表示する|
|[`4-2-format.gdbnb`](./examples/4-2-format.gdbnb)|`print`で出力フォーマットを指定する|
|[`4-3-union.gdbnb`](./examples/4-3-union.gdbnb)|`print`で共用体の値を表示する|
|[`4-4-array.gdbnb`](./examples/4-4-array.gdbnb)|`print`で配列の値を表示する（`@`を使う）|
|[`4-5-scope.gdbnb`](./examples/4-5-scope.gdbnb)|`::`でスコープを指定する|
|[`4-6-printf.gdbnb`](./examples/4-6-printf.gdbnb)|`printf`でC言語のprintf風の表示をする|
|[`4-7-dprintf.gdbnb`](./examples/4-7-dprintf.gdbnb)|`dprintf`で動的なprintfを設定する|


### 関数の呼び出しとスタック

|ファイル名|内容|
|--|--|
|[`5-1-backtrace.gdbnb`](./examples/5-1-backtrace.gdbnb)|`backtrace`でバックトレースを表示する|
|[`5-2-up-down-frame.gdbnb`](./examples/5-2-up-down-frame.gdbnb)|`up`，`down`，`frame`で注目するスタックフレームを変更する|
|[`5-3-info-locals.gdbnb`](./examples/5-3-info-locals.gdbnb)|`info locals`や`info args`で局所変数や引数の値を一括表示する|


### 実行状態の変更

|ファイル名|内容|
|--|--|
|[`6-1-assignment.gdbnb`](./examples/6-1-assignment.gdbnb)|`print`で変数の値を変更する|
|[`6-2-infinite-loop.gdbnb`](./examples/6-2-infinite-loop.gdbnb)|変数の値を変更して，無限ループから脱出する|
|[`6-3-side-effect.gdbnb`](./examples/6-3-side-effect.gdbnb)|副作用を持つ関数を呼び出して，実行状態を変更する|
|[`6-4-jump.gdbnb`](./examples/6-4-jump.gdbnb)|`jump`を使って，無限ループから脱出する|
|[`6-5-return.gdbnb`](./examples/6-5-return.gdbnb)|`return`を使って，関数の返り値を変更する|
|[`6-6-compile.gdbnb`](./examples/6-6-compile.gdbnb)|`compile file`を使って，プログラムを埋め込む|


### よくあるバグのデバッグ

- segmentation fault
- 未初期化変数 -Wall -Wextra
- セグフォしないバッファオーバーフロー
- セグフォせず，スタック破壊
  watch *(long*)$rbp
- ダングリングポインタ
- ライブラリ関数中でクラッシュ

### アセンブリ言語レベルのデバッグ

- アドレス指定でブレーク
- stepi, nexti
- x
- find
- disassemble
- info registers, p/x $rsp
- info frame
- アドレスとシンボルの情報 (info)

### 型

- 型 (whatis, ptype)

### ヘルプ，アプロポス，補完

- ヘルプとアプロポス

## 対応環境

AMD64 Linuxが対象です．仮想環境やコンテナ環境の場合，一部のデバッガ機能，例えばハードウェア`watch`機能が使えない可能性があります．

## 免責事項

このVSCode拡張はGDB学習を支援するために鋭意作成中ですが，まだ未完成です．各自の責任でお使い下さい．
特に，このVSCode拡張はターミナルに`gcc`コマンド等を送り，コンパイルした`a.out`を実行します．悪意のあるプログラムがあるディレクトリ上で，このVSCode拡張を実行すると，悪意のあるプログラムを実行してしまう可能性があります．
安全に試したい場合はGithub Codespaces等の隔離環境での利用を推奨します．

フィードバックや貢献は歓迎します．

## GDBノートブックの方針
- 「コードセルを上から順番に実行すれば，デバッガを操作できる」「同じコマンドをターミナル上で入力しても，同じデバッグ操作をできる」ことを目標にしています．
  - このため，コードセル実行では「ターミナルにコマンド列を送る」だけの実装をしています．この実装方法ではターミナルの出力監視が難しいため，実行に時間がかかった場合など，うまく実行できなくなることがあります
- GDBノートブックごとに個別のターミナルを起動します．ノートブックごとに実行状態を別々に保つためです．
- Copilotによるコード補完はオフをお勧めします．
- コードセル中のコード補完機能は以下の3つのモードがあり，切り替え可能です．
  - LONG:  正解で使われているコマンド（引数を含む）のみを表示します．（例：`break main`）
  - SHORT: 正解で使われているコマンド（引数を含まない）のみを表示します．（例：`break`）
  - ALL: （この拡張中で定義されている）すべてのコマンドを表示します．
  

## リリースノート

### 0.0.1

GDBノートブックの最初のリリース．
