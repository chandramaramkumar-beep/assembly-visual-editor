; ============================================
;  Assembly Visual Editor — feature tour
; ============================================

; --- 1. Arithmetic ---
  mov rax, 12
  mov rbx, 5
  add rax, rbx
  sub rax, 2
  imul rax, 3

; --- 2. Signed division: rdx:rax / rbx ---
  mov rdx, 0
  mov rbx, 7
  idiv rbx

; --- 3. Branch on a comparison ---
  cmp rax, 6
  je is_six
  mov r8, 111
  jmp after_branch
is_six:
  mov r8, 222
after_branch:

; --- 4. Same-shape loop: registers only, gets compressed ---
  mov rcx, 6
  mov r9, 0
sum_loop:
  add r9, rcx
  loop sum_loop

; --- 5. Shape-changing loop: pushes, never compressed ---
  mov rcx, 4
push_loop:
  push rcx
  loop push_loop

  pop r10
  pop r11
  pop r12
  pop r13

; --- 6. Nested calls build nested frames ---
  mov rdi, 9
  call outer
  jmp finish

outer:
  push rbx
  mov rbx, rdi
  call inner
  add rax, rbx
  pop rbx
  ret

inner:
  mov rax, rdi
  shl rax, 1
  ret

finish:
  nop
