# GDB-notebook README

[![VSCode Marketplace](https://img.shields.io/badge/VSCode-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=gondow.gdb-notebook)

GDB-notebook is a notebook environment in VS Code that lets you run GDB commands interactively, simply by clicking, so you can learn how to use GDB and keep a record of your workflows.
(In contrast, running GDB interactively in a Python notebook is difficult.)
If many of you record and share your GDB sessions, I hope that LLMs will learn from them.
It’s still under development, so only a Japanese version is available at the moment, but I’m planning to create an English version as well.

GDB-notebook は，GDBコマンドをVSCode上で対話的に（クリックするだけで）実行することで，
GDBの使い方を学んだり，GDBの使い方を記録するためのノートブック環境です．
（Pythonノートブックでは，GDBの対話的な実行が困難です）．
皆さんがたくさん記録して公開して下されば，LLMがそれを学習してくれると期待しています．

## 主な機能

- 上から順番に「セルの実行」を押すことで，シェルコマンド（例：`gcc`）や
gdbコマンド（例：`break main`）をターミナル上で実行できます．
- ターミナル上で，同じコマンドを手動で入力しても同じ実行ができます．
  （ここに図を入れる）
- ツールチップ，コードレンズ，コード補完などで，コマンドの説明を見れます．

## サンプルのノートブック

以下はこのVSCode拡張内に同梱しているサンプルのノートブックです．
これを順番に学ぶことで，GDBの使い方を学べます．

- [`examples/EXAMPLE.md`](./examples/EXAMPLE)


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
  - この送信時に，`(gdb)`，`>`，`$`はプロンプトとして削除します．また`#`で始まる行もコメントとして削除します．空行があると，空行を送信するので要注意です(GDBはリターンを押すと，前回と同じコマンドを再実行するからです)．
- GDBノートブックごとに個別のターミナルを起動します．ノートブックごとに実行状態を別々に保つためです．

- Copilotによるコード補完はオフをお勧めします．
- コードセル中のコード補完機能は以下の3つのモードがあり，切り替え可能です．
  - LONG:  正解で使われているコマンド（引数を含む）のみを表示します．（例：`break main`）
  - SHORT: 正解で使われているコマンド（引数を含まない）のみを表示します．（例：`break`）
  - ALL: （この拡張中で定義されている）すべてのコマンドを表示します．
  

## リリースノート

### 0.0.1

GDBノートブックの最初のリリース．
