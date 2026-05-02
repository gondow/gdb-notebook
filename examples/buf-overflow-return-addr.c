#include <stdio.h>

long *laundering (long *p)
{
    return p;
}

void buf_overflow ()
{
    long array [2] = {0xAAAAAAAA, 0xBBBBBBBB};
    long *p = laundering (array); // コンパイラの警告を黙らせるため
    p [4] = 0xABABABAB; // 古い%rbpの値を上書き
    p [5] = 0xCDCDCDCD; // リターンアドレスの値を上書き
}

int main () {
    buf_overflow ();
}
