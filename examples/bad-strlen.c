#include <stdio.h>
#include <string.h> // strlen

int main ()
{
    char *s = (char *)0xdeadbeef;
    printf ("%ld\n", strlen (s));
}
