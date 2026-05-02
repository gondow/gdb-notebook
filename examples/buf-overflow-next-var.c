#include <stdio.h>
#include <string.h>
void buf_overflow (long *p)
{
    long x = 0x11111111, y = 0x22222222;
    printf ("x=%lx, y=%lx\n", x, y);
    memcpy (&x, p, 16);
    printf ("x=%lx, y=%lx\n", x, y);
}

int main ()
{
    long z [2] = {0x33333333, 0x44444444};
    buf_overflow (&z[0]);
}

