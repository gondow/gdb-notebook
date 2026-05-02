#include <stdio.h>
int x = 0xDEADBEEF;

void print_p (int *p)
{
    printf ("p = %p, *p = %x\n", p, *p);
}

void funcA ()
{
    int y = x;
    print_p (&y);
}

void funcB ()
{
    int z;
    print_p (&z);
}

int main (void)
{
    funcA ();
    funcB ();
}
