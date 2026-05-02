#define _GNU_SOURCE
#include <stdio.h>
#include <dlfcn.h>

int main() {
    Dl_info info;

    if (dladdr((void*)main, &info)) {
        printf("symbol: %s\n", info.dli_sname);
    }
}
