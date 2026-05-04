#include <stdio.h>

static const char fmt [] = "x=%d\n";
int main ()
{
    asm ("leaq fmt(%rip), %rdi\n"
    "movq $99, %rsi\n"
    "movq $5, %rax\n"
    "call  printf\n");

}
