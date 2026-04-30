#include <stdio.h>
#include <string.h>

int main () {
    char buf [8];
    strcpy (buf, "AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDD");
    printf ("buf = %s\n", buf);
}
