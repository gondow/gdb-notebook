#include <stdio.h>

int main ()
{
    asm ("subq $8, %rsp");
    printf ("hello\n");
}
