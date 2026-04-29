#include <stdio.h>

int dump_array (int a [], int n)
{
    for (int i = 0; i < n; i++) {
        printf ("[%d]=%d\n", i, a [i]);
    }    
}

int main (void)
{
    int i = 10;
    unsigned int u = 20;
    char c = 'x';

    int array [4] = {10, 20, 30, 40};

    printf ("%d, %c\n", i + u, c);
    dump_array (array, 4);
}
