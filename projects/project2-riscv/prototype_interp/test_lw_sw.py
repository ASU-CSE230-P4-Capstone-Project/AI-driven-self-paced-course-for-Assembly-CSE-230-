import pytest

from instructions import LW, SW
from machine import MachineState
from stringParse import preprocessAssemblyForEmulator, sourceToInstructions


def test_source_parser_accepts_canonical_lw_sw_syntax():
  instructions = sourceToInstructions("lw x5, 12(x2)\nsw x7, -8(x3)")

  assert len(instructions) == 2
  assert isinstance(instructions[0], LW)
  assert instructions[0].dIdx == 5
  assert instructions[0].aIdx == 2
  assert instructions[0].imm == 12
  assert isinstance(instructions[1], SW)
  assert instructions[1].sIdx == 7
  assert instructions[1].aIdx == 3
  assert instructions[1].imm == -8


def test_source_parser_accepts_abi_registers_in_load_store_operands():
  instructions = sourceToInstructions("lw t1, 0(t0)\nsw t3, 4(sp)")

  assert len(instructions) == 2
  assert isinstance(instructions[0], LW)
  assert instructions[0].dIdx == 6
  assert instructions[0].aIdx == 5
  assert instructions[0].imm == 0
  assert isinstance(instructions[1], SW)
  assert instructions[1].sIdx == 28
  assert instructions[1].aIdx == 2
  assert instructions[1].imm == 4


def test_source_parser_accepts_legacy_four_token_lw_sw_syntax():
  instructions = sourceToInstructions("lw x5, x2, 12\nsw x7, x3, -8")

  assert len(instructions) == 2
  assert isinstance(instructions[0], LW)
  assert instructions[0].dIdx == 5
  assert instructions[0].aIdx == 2
  assert instructions[0].imm == 12
  assert isinstance(instructions[1], SW)
  assert instructions[1].sIdx == 7
  assert instructions[1].aIdx == 3
  assert instructions[1].imm == -8


def test_lw_parses_canonical_operand():
  instruction = LW.parseFromSourceTokens(["lw", "x5", "12(x2)"])

  assert instruction.dIdx == 5
  assert instruction.aIdx == 2
  assert instruction.imm == 12


def test_lw_parses_abi_base_register_operand():
  instruction = LW.parseFromSourceTokens(["lw", "t1", "12(t0)"])

  assert instruction.dIdx == 6
  assert instruction.aIdx == 5
  assert instruction.imm == 12


def test_sw_parses_canonical_operand():
  instruction = SW.parseFromSourceTokens(["sw", "x7", "-8(x3)"])

  assert instruction.sIdx == 7
  assert instruction.aIdx == 3
  assert instruction.imm == -8


def test_sw_parses_abi_base_register_operand():
  instruction = SW.parseFromSourceTokens(["sw", "t3", "-8(sp)"])

  assert instruction.sIdx == 28
  assert instruction.aIdx == 2
  assert instruction.imm == -8


def test_lw_parses_legacy_four_token_syntax():
  instruction = LW.parseFromSourceTokens(["lw", "x5", "x2", "12"])

  assert instruction.dIdx == 5
  assert instruction.aIdx == 2
  assert instruction.imm == 12


def test_sw_parses_legacy_four_token_syntax():
  instruction = SW.parseFromSourceTokens(["sw", "x7", "x3", "-8"])

  assert instruction.sIdx == 7
  assert instruction.aIdx == 3
  assert instruction.imm == -8


def test_preprocess_preserves_canonical_lw_sw_syntax():
  processed, data_words = preprocessAssemblyForEmulator("lw x5, 12(x2)\nsw x7, -8(x3)")

  assert processed == "lw x5, 12(x2)\nsw x7, -8(x3)"
  assert data_words == []


@pytest.mark.parametrize(
  ("instruction_cls", "tokens"),
  [
    (LW, ["lw", "x1", "x2"]),
    (LW, ["lw", "x1", "(x2)"]),
    (SW, ["sw", "x3", "foo(x4)"]),
    (LW, ["lw", "x1", "2048(x2)"]),
    (SW, ["sw", "x3", "-2049(x4)"]),
    (LW, ["lw", "x1", "x2", "2048"]),
    (SW, ["sw", "x3", "x4", "-2049"]),
  ],
)
def test_lw_sw_reject_invalid_operands(instruction_cls, tokens):
  with pytest.raises(ValueError):
    instruction_cls.parseFromSourceTokens(tokens)


def test_sw_and_lw_use_little_endian_word_layout():
  state = MachineState()
  state.regs[1].value = 0x11223344
  state.regs[2].value = 8

  SW(1, 2, 0).forward(state)

  assert [state.memory[i].value for i in range(8, 12)] == [0x44, 0x33, 0x22, 0x11]

  LW(3, 2, 0).forward(state)

  assert state.regs[3].value == 0x11223344


def test_sw_rejects_unaligned_word_access():
  state = MachineState()
  state.regs[1].value = 0x12345678
  state.regs[2].value = 2

  with pytest.raises(ValueError, match="Unaligned word access"):
    SW(1, 2, 0).forward(state)


def test_lw_rejects_unaligned_word_access():
  state = MachineState()
  state.regs[2].value = 2

  with pytest.raises(ValueError, match="Unaligned word access"):
    LW(1, 2, 0).forward(state)


def test_sw_updates_memory_mapped_led_address():
  state = MachineState()
  state.regs[1].value = 0x12345678
  state.regs[2].value = 0x3F0

  SW(1, 2, 0).forward(state)

  assert [state.memory[i].value for i in range(0x3F0, 0x3F4)] == [
    0x78,
    0x56,
    0x34,
    0x12,
  ]


def test_sw_updates_memory_mapped_seven_segment_address():
  state = MachineState()
  state.regs[1].value = 0x89ABCDEF
  state.regs[2].value = 0x3F4

  SW(1, 2, 0).forward(state)

  assert [state.memory[i].value for i in range(0x3F4, 0x3F8)] == [
    0xEF,
    0xCD,
    0xAB,
    0x89,
  ]
