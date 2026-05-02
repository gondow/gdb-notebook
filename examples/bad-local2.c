// $ gcc -g -finstrument-functions bad-local2.c
#include <stdio.h>
#include <string.h>

__attribute__((no_instrument_function))
void __cyg_profile_func_exit (void *this_fn, void *call_site) {
    char *rsp, *rbp;
    asm volatile ("movq %%rbp, %0": "=m"(rsp));
    asm volatile ("movq (%%rbp), %0": "=r"(rbp));
    printf ("this function: %p, rsp=%p, rbp=%p\n", this_fn, rsp, rbp);
    memset (rsp+16, 0xAB, (rbp-8)-(rsp+16));
}

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
