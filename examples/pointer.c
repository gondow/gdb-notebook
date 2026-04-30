#include <stdio.h>
int main (void)
{
    int x = 0x11223344;
    int *p = &x;
    printf ("p=%p, *p=%x, x=%x\n", p, *p, x);
}
