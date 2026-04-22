from instructions import BGEU, BLTU
from machine import MachineState
from stringParse import sourceToInstructions


def test_source_parser_accepts_bgeu_tokens():
  instructions = sourceToInstructions("bgeu x28, x29, 1")

  assert len(instructions) == 1
  assert isinstance(instructions[0], BGEU)
  assert instructions[0].aIdx == 28
  assert instructions[0].bIdx == 29
  assert instructions[0].imm == 1


def test_bgeu_takes_unsigned_branch():
  state = MachineState()
  state.regs[1].value = 10
  state.regs[2].value = 5

  result = BGEU(1, 2, 3).forward(state)

  assert result is state
  assert state.isJumping is True
  assert state.jumpOffset == 3


def test_bltu_returns_state_and_takes_unsigned_branch():
  state = MachineState()
  state.regs[1].value = 5
  state.regs[2].value = 10

  result = BLTU(1, 2, 2).forward(state)

  assert result is state
  assert state.isJumping is True
  assert state.jumpOffset == 2
