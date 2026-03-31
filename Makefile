

compile:
	rm -rf out
	npm run compile

package: 
	vsce package

install: package
	code --install-extension gdb-notebook-0.0.1.vsix

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
