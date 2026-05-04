#include <stdio.h>
#include <stdlib.h>

void use_rbx (void) {
    asm ("movq (%rbx), %rax");
}

int main ()
{
    printf ("hello\n");
    asm ("movq $0xDEADBEEFDEADBEEF, %rbx");
    atexit (use_rbx);
}
