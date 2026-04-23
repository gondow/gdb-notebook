
all:
	make install && code

compile:
	rm -rf out
	$(MAKE) -C src gdb.tmGrammar.json
	npm run compile

package: compile
	vsce package

install: package
	code --install-extension gdb-notebook-0.0.1.vsix
#	code --remote ssh-remote+ubuntu-utm --install-extension  gdb-notebook-0.0.1.vsix
# リモートは手動でやる

uninstall:
	code --uninstall-extension gondow.gdb-notebook

ls: 
	vsce ls --tree

20:
	@echo "これはシェルで実行しないと効かない"
	. ~/.nvm/nvm.sh && nvm use 20	

clean:
	rm -f *~ a.out
	rm -rf a.out.dSYM out
