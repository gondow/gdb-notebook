import gdb
import subprocess

# マニュアル
# https://sourceware.org/gdb/current/onlinedocs/gdb.html/Python-API.html#Python-API

active_finish_bps = []

# コール直前にブレーク
class CallBreakpoint(gdb.Breakpoint):
    def stop(self):
        try:
            frame = gdb.newest_frame()
            print(f"{frame.name()}:")
            rsp = int(frame.read_register("rsp"))
            if rsp % 16 != 0:
                print(f"[!] %rsp ({rsp:#x} is not aligned to a 16-byte boundary.")
                return True

        finally:
            if self in active_finish_bps:
                active_finish_bps.remove(self)

        return False

    def out_of_scope(self):
        if self in active_finish_bps:
            active_finish_bps.remove(self)


class EntryBreakpoint(gdb.Breakpoint):
    is_main_called = False

    def stop(self):
        frame = gdb.newest_frame()
        if frame.name() == "main":
            EntryBreakpoint.is_main_called = True
        if EntryBreakpoint.is_main_called == False:
            return False
        print(f"→function={frame.name()}")
        block = frame.block()
        while block:
            if block.function:
                break
            block = block.superblock
        arch = frame.architecture()
        instructions = arch.disassemble(block.start, block.end)
        # print(instructions)
        for instruction in instructions:
            if instruction['asm'].startswith('call'):
                bp = CallBreakpoint(f"*{instruction['addr']}")
                active_finish_bps.append(bp)
        return False

class CheckCallAlign(gdb.Command):
    def __init__(self):
        super().__init__(
            'check-callalign',
            gdb.COMMAND_USER, # help の分類に使われるコマンドの種類
            gdb.COMPLETE_NONE, # 補完機能をどうするか
            False # サブコマンドの有無（無し）
        )
    def invoke(self, arg, from_tty):
        # a.out中からグローバルな関数名を取り出してブレークポイントを張る
        functions = subprocess.check_output("nm ./a.out | egrep ' T ' | awk '{print $3}'", shell=True, text=True).splitlines()
        for function in functions:
            EntryBreakpoint(f"*{function}")

CheckCallAlign()

