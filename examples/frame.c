#include <stdio.h>

void func_B (int m, int n)
{
    int b1 = 300, b2 = 400;
    printf ("func_B: m=%d, n=%d, b1=%d, b2=%d\n", m, n, b1, b2);
}

void func_A (int m, int n)
{
    int a1 = 30, a2 = 40;
    func_B (100, 200);
    printf ("func_A: m=%d, n=%d, a1=%d, a2=%d\n", m, n, a1, a2);
}

int main (void)
{
    func_A (10, 20);
}
