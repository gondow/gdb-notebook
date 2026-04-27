#include <stdio.h>

void func_B (int n)
{
    int b = 10;
    printf ("func_B: %d, %d\n", n, b);
}

void func_A (int n)
{
    int a = 20;
    func_B (n + 1);
    printf ("func_A: %d, %d\n", n, a);
}

int main (void)
{
    func_A (100);
}
