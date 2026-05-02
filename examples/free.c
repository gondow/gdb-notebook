#include <stdio.h>
#include <stdlib.h> 

int main ()
{
    char *s = (char *)0xdeadbeef;
    free (s);
}
