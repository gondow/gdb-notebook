#define _GNU_SOURCE
#include <stdio.h>
#include <dlfcn.h>

int main ();

__attribute__((no_instrument_function))
void __cyg_profile_func_enter (void *this_fn, void *call_site) {
    Dl_info info;
    dladdr (this_fn, &info);
    printf("enter: %s\n", info.dli_sname);
}

__attribute__((no_instrument_function))
void __cyg_profile_func_exit (void *this_fn, void *call_site) {
    char *old_rbp;
    asm volatile ("movq (%%rbp), %0": "=r"(old_rbp));
    long return_addr = *(long *)(old_rbp + 8);
    Dl_info info;
    dladdr (this_fn, &info);
    printf("exit: %s (return_addr=%lx)\n", info.dli_sname, return_addr);
}

long *laundering (long *p)
{
    return p;
}

void buf_overflow ()
{
    long array [2] = {0xAAAAAAAA, 0xBBBBBBBB};
    long *p = laundering (array); // コンパイラの警告を黙らせるため
    p [4] = 0xABABABAB; // 古い%rbpの値を上書き
    p [5] = 0xCDCDCDCD; // リターンアドレスの値を上書き
}

int main () {
    buf_overflow ();
}
