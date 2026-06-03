import gdb
import subprocess

# マニュアル
# https://sourceware.org/gdb/current/onlinedocs/gdb.html/Python-API.html#Python-API

active_finish_bps = []

# リターン直前にブレーク
class ReturnBreakpoint(gdb.Breakpoint):
    def __init__(self, spec, expected_retaddr):
        super().__init__(spec, internal=False)
        self.expected_retaddr = expected_retaddr

    def stop(self):
        try:
            actual_retaddr = int(gdb.parse_and_eval("*(void**)($rsp)"))
            current = gdb.newest_frame()
            print(f"←{current.name()}: actual_retaddr={hex(actual_retaddr)}")
            if actual_retaddr != self.expected_retaddr:
                print(
                    f"[!] Return address changed: "
                    f"expected={hex(self.expected_retaddr)} "
                    f"actual={hex(actual_retaddr)}"
                )
                return True

        finally:
            if self in active_finish_bps:
                active_finish_bps.remove(self)

        return False

    def out_of_scope(self):
        if self in active_finish_bps:
            active_finish_bps.remove(self)


class EntryBreakpoint(gdb.Breakpoint):
    def stop(self):
        expected_retaddr = int(gdb.parse_and_eval("*(void**)($rsp)"))
        frame = gdb.newest_frame()
        print(f"→{frame.name()}: expected={hex(expected_retaddr)} ")

        block = frame.block()
        while block:
            if block.function:
                break
            block = block.superblock
        arch = frame.architecture()
        instructions = arch.disassemble(block.start, block.end)
        for instruction in instructions:
            if instruction['asm'].startswith('ret'):
                bp = ReturnBreakpoint(f"*{instruction['addr']}", expected_retaddr)
                active_finish_bps.append(bp)
        return False

class CheckReturnAddress(gdb.Command):
    def __init__(self):
        super().__init__(
            'check-retaddr',
            gdb.COMMAND_USER, # help の分類に使われるコマンドの種類
            gdb.COMPLETE_NONE, # 補完機能をどうするか
            False # サブコマンドの有無（無し）
        )
    def invoke(self, arg, from_tty):
        # 引数を分解したい時は gdb.string_to_argv を使う
        # a.out中からグローバルな関数名を取り出してブレークポイントを張る
        functions = subprocess.check_output("nm ./a.out | egrep ' T ' | awk '{print $3}'", shell=True, text=True).splitlines()
        for function in functions:
            EntryBreakpoint(f"*{function}")

CheckReturnAddress()

