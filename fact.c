#include <stdio.h>

int fact (int n)
{
    if (n <= 0) {
        return 1;
    } else {
        return n * fact (n - 1);
    }
}

int main (void)
{
    printf ("fact (%d) = %d\n", 5, fact (5));
}
