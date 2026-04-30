#include <stdio.h>
struct foo {
    char x1;
    int x2;
};
int main ()
{
    struct foo f = {'A', 0x11223344};
    printf ("f.x1=%c, f.x2=%x\n", f.x1, f.x2);
}
