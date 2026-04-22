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
|[`1-1-gdb-basic.gdbnb`](./examples/1-1-gdb-basic.gdbnb)|デバッグオプション付きでコンパイルし，gdb上で`a.out`を実行する|
|[`1-2-break1.gdbnb`](./examples/1-2-break1.gdbnb)|`break`で関数名を指定してブレークする|
|[`1-2-break2.gdbnb`](./examples/1-2-break2.gdbnb)|`break`で行番号を指定してブレークする|
|[`1-3-print1.gdbnb`](./examples/1-3-print1.gdbnb)|`print`で変数の値を表示する|
|[`1-3-print2.gdbnb`](./examples/1-3-print2.gdbnb)|表示フォーマットを指定して変数の値を表示する|
|[`1-4-step.gdbnb`](./examples/1-4-step.gdbnb)|`step`でステップ実行する|

### ステップ実行

|ファイル名|内容|
|--|--|
|[`1-5-display.gdbnb`](./examples/1-5-display.gdbnb)|`display`で変数の値を自動表示する|

- step, next, finish の違い

### ブレークポイント

- break
- continue

### 実行状態（変数）の観察

- print

### 関数の呼び出しとスタック

- backtrace

### 実行状態の変更

### よくあるバグのデバッグ

- segmentation fault

### アセンブリ言語レベルのデバッグ

- アドレス指定でブレーク
- stepi, nexti
- x
- disassemble
- アドレスとシンボルの情報 (info)

### その他

- watchpoint
- 型 (whatis, ptype)
- ヘルプとアプロポス

## 免責事項

このVSCode拡張はGDB学習を支援するために鋭意作成中ですが，まだ未完成です．各自の責任でお使い下さい．
特に，このVSCode拡張はターミナルに`gcc`コマンド等を送り，コンパイルした`a.out`を実行します．悪意のあるプログラムがあるディレクトリ上で，このVSCode拡張を実行すると，悪意のあるプログラムを実行してしまう可能性があります．
安全に試したい場合はGithub Codespaces等の隔離環境での利用を推奨します．

フィードバックや貢献は歓迎します．

## リリースノート

### 0.0.1

GDBノートブックの最初のリリース．
