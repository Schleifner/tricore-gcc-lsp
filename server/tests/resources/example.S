  .file "c_demo.c"
.section .text,"ax",@progbits
.Ltext0:  
  .align 1
  .global swap
  .type swap, @function
swap:
  mov.aa %a14, %SP
  sub.a %SP, 8
  st.w [%a14] -4, %d4
  st.w [%a14] -8, %d5
  ld.w %d2, [%a14] -4
  ld.w %d15, [%a14] -8
  xor %d15, %d2
  st.w [%a14] -4, %d15
  ld.w %d2, [%a14] -8
  ld.w %d15, [%a14] -4
  xor %d15, %d2
  st.w [%a14] -8, %d15
  ld.w %d2, [%a14] -4
  ld.w %d15, [%a14] -8
  xor %d15, %d2
  st.w [%a14] -4, %d15
  nop
  ret

.LC0$:
  .string "Hello World"
main: 
  mov.aa %a14, %SP 
  sub.a %SP, 8
  mov %d15, 64
  st.w [%a14] -4, %d15
  ld.w %d5, [%a14] -8
  ld.w %d4, [%a14] -4
  call swap
  mov %d15, 0
  mov %d2, %d15
  movh %d15, hi:.LC0$
  mov.a %a15,%d15
  lea %a4, [%a15] lo:.LC0$
  call printf
  mov %d15, 0
  j 12f
  0$: 
  st.b [%a3+]1, %d2
  12: 
  loop %a4, 0$b
  ret
    
  .extern printf,STT_FUNC,0