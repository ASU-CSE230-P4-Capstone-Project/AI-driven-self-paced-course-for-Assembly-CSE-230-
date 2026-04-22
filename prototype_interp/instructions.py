"""
Our core set of instructions.

One way to implement an instruction, that is STUPID
simple, is to think about an instruction as simply an
operation that takes in a machine state, and returns a new
machine state. That's how we'll design it, for now.
"""
import re
from abc import ABC, abstractmethod
from typing import List

from machine import Register, MemoryAddress, MachineState

from pydantic import BaseModel

LOAD_STORE_IMM_MIN = -2048
LOAD_STORE_IMM_MAX = 2047
LOAD_STORE_OPERAND_PATTERN = re.compile(r"^(-?\d+|0[xX][0-9a-fA-F]+)\(([A-Za-z0-9]+)\)$")

def checkRegister(token: str) -> int:
  """
  Validates that a token is a valid register format (e.g., 'x0', 'x15')
  and returns the register index as an integer.
  
  Raises ValueError if the token is not a valid register.
  """
  # Support ABI register aliases (t0/t1/a0/a7/s0/...).
  # Existing code primarily uses x0-x31, but many student labs use ABI names.
  token_norm = token.strip().lower()
  abi_to_reg = {
    "zero": 0,
    "ra": 1,
    "sp": 2,
    "gp": 3,
    "tp": 4,
    "t0": 5,
    "t1": 6,
    "t2": 7,
    "s0": 8,
    "fp": 8,
    "s1": 9,
    "a0": 10,
    "a1": 11,
    "a2": 12,
    "a3": 13,
    "a4": 14,
    "a5": 15,
    "a6": 16,
    "a7": 17,
    "s2": 18,
    "s3": 19,
    "s4": 20,
    "s5": 21,
    "s6": 22,
    "s7": 23,
    "s8": 24,
    "s9": 25,
    "s10": 26,
    "s11": 27,
    "t3": 28,
    "t4": 29,
    "t5": 30,
    "t6": 31,
  }

  if token_norm in abi_to_reg:
    return abi_to_reg[token_norm]

  if not token_norm.startswith('x'):
    raise ValueError(f"Invalid register format: '{token}'. Expected ABI alias or 'x<number>'")
  
  try:
    reg_idx = int(token_norm[1:])
  except ValueError:
    raise ValueError(f"Invalid register format: '{token}'. Expected format: 'x<number>'")
  
  # RISC-V has 32 registers (x0-x31)
  if reg_idx < 0 or reg_idx > 31:
    raise ValueError(f"Register index out of range: '{token}'. Valid range: x0-x31")
  
  return reg_idx

def checkImmediate(token: str) -> int:
  """
  Validates that a token is a valid immediate value and returns it as an integer.
  
  Supports decimal (e.g., '10', '-5') and hexadecimal (e.g., '0x10') formats.
  Raises ValueError if the token is not a valid immediate value.
  """
  try:
    # Handle both decimal and hex formats
    if token.startswith('0x') or token.startswith('0X'):
      return int(token, 16)
    else:
      return int(token)
  except ValueError:
    raise ValueError(f"Invalid immediate value: '{token}'. Expected a decimal or hexadecimal number")

def parseLoadStoreOperand(token: str) -> tuple[int, int]:
  """
  Parse an RV32I load/store operand like '12(x2)' or '12(t0)'.
  """
  match = LOAD_STORE_OPERAND_PATTERN.fullmatch(token)
  if match is None:
    raise ValueError(
      f"Invalid load/store operand: '{token}'. Expected format: '<offset>(<register>)'"
    )

  imm = checkImmediate(match.group(1))
  if imm < LOAD_STORE_IMM_MIN or imm > LOAD_STORE_IMM_MAX:
    raise ValueError(
      f"Load/store immediate out of RV32I 12-bit signed range: {imm}. "
      f"Valid range: {LOAD_STORE_IMM_MIN} to {LOAD_STORE_IMM_MAX}"
    )
  aIdx = checkRegister(match.group(2))
  return aIdx, imm

def checkLoadStoreImmediate(token: str) -> int:
  """
  Validate a load/store immediate using the RV32I 12-bit signed range.
  """
  imm = checkImmediate(token)
  if imm < LOAD_STORE_IMM_MIN or imm > LOAD_STORE_IMM_MAX:
    raise ValueError(
      f"Load/store immediate out of RV32I 12-bit signed range: {imm}. "
      f"Valid range: {LOAD_STORE_IMM_MIN} to {LOAD_STORE_IMM_MAX}"
    )
  return imm

def parseLoadStoreAddressTokens(tokens: List[str]) -> tuple[int, int]:
  """
  Parse either canonical `offset(base)` addressing or the legacy `base, offset`
  form used by older course examples.
  """
  if len(tokens) == 1:
    return parseLoadStoreOperand(tokens[0])

  if len(tokens) == 2:
    aIdx = checkRegister(tokens[0])
    imm = checkLoadStoreImmediate(tokens[1])
    return aIdx, imm

  raise ValueError(
    f"Invalid load/store operands: {tokens}. Expected either '<offset>(<register>)' "
    f"or '<register>, <offset>'"
  )

class Instruction(ABC):
  KNOWN_INSTRUCTIONS = set()

  def __init_subclass__(cls):
    # All it needs to do
    # is add itself to KNOWN_INSTRUCTIONS
    Instruction.KNOWN_INSTRUCTIONS.add(cls)

  """
  The base type for an instruction.
  """

  @staticmethod
  @abstractmethod
  def getName() -> str:
    """
    Returns the lowercase name of the instruction as it appears in source code.
    This should match the instruction mnemonic used in assembly.
    
    Returns:
      The lowercase instruction name (e.g., 'add', 'addi', 'xor')
    """
    pass

  @staticmethod
  @abstractmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'Instruction':
    """
    Parse an instruction from a list of source tokens.
    
    Args:
      tokens: A list of tokens where the first token is the instruction
              mnemonic and the remaining tokens are operands.
              Example: ['ADD', 'x0', 'x1', 'x2']
    
    Returns:
      An instance of the instruction class
    
    Raises:
      ValueError: If the tokens are invalid or don't match the instruction format
    """
    pass

  @abstractmethod
  def forward(self, state : MachineState) -> MachineState:
    pass

class ADD(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'add'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'ADD':
    """
    Parse ADD instruction from tokens.
    Expected format: ['add', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"ADD instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'add':
      raise ValueError(f"Expected 'add' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return ADD(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of ADD
    dIdx = aIdx + bIdx
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    state.regs[self.dIdx].value = (aVal + bVal) % (2 ** 32)

    return state

class ADDI(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'addi'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'ADDI':
    """
    Parse ADDI instruction from tokens.
    Expected format: ['addi', 'x0', 'x1', '10']
    """
    if len(tokens) != 4:
      raise ValueError(f"ADDI instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'addi':
      raise ValueError(f"Expected 'addi' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return ADDI(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of ADDI
    dIdx = aIdx + imm
    """
    aVal = state.regs[self.aIdx].value
    immVal = self.imm

    state.regs[self.dIdx].value = (aVal + immVal) % (2 ** 32)

    return state

class XOR(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'xor'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'XOR':
    """
    Parse XOR instruction from tokens.
    Expected format: ['xor', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"XOR instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'xor':
      raise ValueError(f"Expected 'xor' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return XOR(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of XOR
    dIdx = aIdx ^ bIdx
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    state.regs[self.dIdx].value = (aVal ^ bVal)

    return state

class XORI(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'xori'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'XORI':
    """
    Parse XORI instruction from tokens.
    Expected format: ['xori', 'x0', 'x1', '10']
    """
    if len(tokens) != 4:
      raise ValueError(f"XORI instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'xori':
      raise ValueError(f"Expected 'xori' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return XORI(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of XORI
    dIdx = aIdx ^ imm
    """
    aVal = state.regs[self.aIdx].value
    immVal = self.imm

    state.regs[self.dIdx].value = (aVal ^ immVal)

    return state

class OR(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'or'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'OR':
    """
    Parse OR instruction from tokens.
    Expected format: ['or', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"OR instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'or':
      raise ValueError(f"Expected 'or' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return OR(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of OR
    dIdx = aIdx | bIdx
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    state.regs[self.dIdx].value = (aVal | bVal)

    return state

class ORI(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'ori'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'ORI':
    """
    Parse ORI instruction from tokens.
    Expected format: ['ori', 'x0', 'x1', '10']
    """
    if len(tokens) != 4:
      raise ValueError(f"ORI instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'ori':
      raise ValueError(f"Expected 'ori' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return ORI(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of ORI
    dIdx = aIdx | imm
    """
    aVal = state.regs[self.aIdx].value
    immVal = self.imm

    state.regs[self.dIdx].value = (aVal | immVal)

    return state

class AND(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'and'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'AND':
    """
    Parse AND instruction from tokens.
    Expected format: ['and', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"AND instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'and':
      raise ValueError(f"Expected 'and' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return AND(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of AND
    dIdx = aIdx & bIdx
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    state.regs[self.dIdx].value = (aVal & bVal)

    return state

class ANDI(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'andi'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'ANDI':
    """
    Parse ANDI instruction from tokens.
    Expected format: ['andi', 'x0', 'x1', '10']
    """
    if len(tokens) != 4:
      raise ValueError(f"ANDI instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'andi':
      raise ValueError(f"Expected 'andi' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return ANDI(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of ANDI
    dIdx = aIdx & imm
    """
    aVal = state.regs[self.aIdx].value
    immVal = self.imm

    state.regs[self.dIdx].value = (aVal & immVal)

    return state

class SLT(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'slt'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SLT':
    """
    Parse SLT instruction from tokens.
    Expected format: ['slt', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"SLT instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'slt':
      raise ValueError(f"Expected 'slt' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return SLT(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SLT (Set Less Than)
    dIdx = 1 if aIdx < bIdx else 0 (signed comparison)
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    # Convert to signed for comparison
    aValSigned = aVal if aVal < 2**31 else aVal - 2**32
    bValSigned = bVal if bVal < 2**31 else bVal - 2**32

    state.regs[self.dIdx].value = 1 if aValSigned < bValSigned else 0

    return state

class SLTI(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'slti'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SLTI':
    """
    Parse SLTI instruction from tokens.
    Expected format: ['slti', 'x0', 'x1', '10']
    """
    if len(tokens) != 4:
      raise ValueError(f"SLTI instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'slti':
      raise ValueError(f"Expected 'slti' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return SLTI(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SLTI (Set Less Than Immediate)
    dIdx = 1 if aIdx < imm else 0 (signed comparison)
    """
    aVal = state.regs[self.aIdx].value
    immVal = self.imm

    # Convert to signed for comparison
    aValSigned = aVal if aVal < 2**31 else aVal - 2**32
    immValSigned = immVal if immVal < 2**31 else immVal - 2**32

    state.regs[self.dIdx].value = 1 if aValSigned < immValSigned else 0

    return state

class SUB(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'sub'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SUB':
    """
    Parse SUB instruction from tokens.
    Expected format: ['sub', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"SUB instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'sub':
      raise ValueError(f"Expected 'sub' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return SUB(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SUB (Subtract)
    dIdx = aIdx - bIdx
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    state.regs[self.dIdx].value = (aVal - bVal) % (2 ** 32)

    return state
  
class LUI(Instruction):
  def __init__(self, dIdx, imm):
    self.dIdx = dIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'lui'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'ANDI':
    """
    Parse LUI instruction from tokens.
    Expected format: ['lui', 'x0', '10']
    """
    if len(tokens) != 3:
      raise ValueError(f"LUI instruction expects 3 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'lui':
      raise ValueError(f"Expected 'lui' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    imm = checkImmediate(tokens[3])
    
    return LUI(dIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of LUI
    dIdx = aIdx & imm
    """
    immVal = self.imm

    result = (immVal << 12) & 0xFFFFFFFF

    state.regs[self.dIdx].value = (result)

    return state
class AUIPC(Instruction):
  def __init__(self, dIdx, imm):
    self.dIdx = dIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'auipc'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'ANDI':
    """
    Parse AUIPC instruction from tokens.
    Expected format: ['auipc', 'x0', '10']
    """
    if len(tokens) != 3:
      raise ValueError(f"AUIPC instruction expects 3 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'auipc':
      raise ValueError(f"Expected 'auipc' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    imm = checkImmediate(tokens[3])
    
    return AUIPC(dIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of AUIPC
    dIdx = aIdx & imm
    """
    immVal = self.imm
    current_pc = state.pc

    imm32 = (immVal << 12) & 0xFFFFFFFF
    result = (current_pc + imm32) & 0xFFFFFFFF

    state.regs[self.dIdx].value = (result)

    return state
  
class SLTU(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'sltu'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SLT':
    """
    Parse SLTU instruction from tokens.
    Expected format: ['sltu', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"SLTU instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'sltu':
      raise ValueError(f"Expected 'sltu' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return SLTU(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SLTU (Set Less Than Unsigned)
    dIdx = 1 if aIdx < bIdx else 0 (signed comparison)
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    # # Convert to signed for comparison
    # aValSigned = aVal if aVal < 2**31 else aVal - 2**32
    # bValSigned = bVal if bVal < 2**31 else bVal - 2**32

    state.regs[self.dIdx].value = 1 if aVal < bVal else 0

    return state

class SLTIU(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'sltiu'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SLTI':
    """
    Parse SLTIU instruction from tokens.
    Expected format: ['sltiu', 'x0', 'x1', '10']
    """
    if len(tokens) != 4:
      raise ValueError(f"SLTIu instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'sltiu':
      raise ValueError(f"Expected 'sltiu' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return SLTIU(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SLTI (Set Less Than Immediate)
    dIdx = 1 if aIdx < imm else 0 (signed comparison)
    """
    aVal = state.regs[self.aIdx].value
    immVal = self.imm

    # # Convert to signed for comparison
    # aValSigned = aVal if aVal < 2**31 else aVal - 2**32
    # immValSigned = immVal if immVal < 2**31 else immVal - 2**32

    state.regs[self.dIdx].value = 1 if aVal < immVal else 0

    return state

class SLL(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'sll'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SLL':
    """
    Parse SLL instruction from tokens.
    Expected format: ['sll', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"SLL instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'sll':
      raise ValueError(f"Expected 'sll' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return SLL(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SLL (Shift Left Logical)
    dIdx = aIdx << bIdx (lower 5 bits of bIdx)
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value & 0x1F  # Mask to 5 bits (0-31)

    state.regs[self.dIdx].value = (aVal << bVal) % (2 ** 32)

    return state

class SLLI(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'slli'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SLLI':
    """
    Parse SLLI instruction from tokens.
    Expected format: ['slli', 'x0', 'x1', '10']
    """
    if len(tokens) != 4:
      raise ValueError(f"SLLI instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'slli':
      raise ValueError(f"Expected 'slli' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return SLLI(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SLLI (Shift Left Logical Immediate)
    dIdx = aIdx << imm (lower 5 bits of imm)
    """
    aVal = state.regs[self.aIdx].value
    immVal = self.imm & 0x1F  # Mask to 5 bits (0-31)

    state.regs[self.dIdx].value = (aVal << immVal) % (2 ** 32)

    return state

class SRL(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'srl'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SRL':
    """
    Parse SRL instruction from tokens.
    Expected format: ['srl', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"SRL instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'srl':
      raise ValueError(f"Expected 'srl' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return SRL(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SRL (Shift Right Logical)
    dIdx = aIdx >> bIdx (lower 5 bits of bIdx)
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value & 0x1F  # Mask to 5 bits (0-31)

    state.regs[self.dIdx].value = (aVal >> bVal)

    return state

class SRLI(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'srli'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SRLI':
    """
    Parse SRLI instruction from tokens.
    Expected format: ['srli', 'x0', 'x1', '10']
    """
    if len(tokens) != 4:
      raise ValueError(f"SRLI instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'srli':
      raise ValueError(f"Expected 'srli' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return SRLI(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SRLI (Shift Right Logical Immediate)
    dIdx = aIdx >> imm (lower 5 bits of imm)
    """
    aVal = state.regs[self.aIdx].value
    immVal = self.imm & 0x1F  # Mask to 5 bits (0-31)

    state.regs[self.dIdx].value = (aVal >> immVal)

    return state

class SRA(Instruction):
  def __init__(self, dIdx, aIdx, bIdx):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.bIdx = bIdx

  @staticmethod
  def getName() -> str:
    return 'sra'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SRA':
    """
    Parse SRA instruction from tokens.
    Expected format: ['sra', 'x0', 'x1', 'x2']
    """
    if len(tokens) != 4:
      raise ValueError(f"SRA instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'sra':
      raise ValueError(f"Expected 'sra' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    bIdx = checkRegister(tokens[3])
    
    return SRA(dIdx, aIdx, bIdx)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SRA (Shift Right Arithmetic)
    dIdx = aIdx >> bIdx (arithmetic shift - sign bit preserved)
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value & 0x1F  # Mask to 5 bits (0-31)

    # Convert to signed, shift, convert back to unsigned
    aValSigned = aVal if aVal < 2**31 else aVal - 2**32
    resultSigned = aValSigned >> bVal
    
    state.regs[self.dIdx].value = resultSigned % (2 ** 32)

    return state

class SRAI(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'srai'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SRAI':
    """
    Parse SRAI instruction from tokens.
    Expected format: ['srai', 'x0', 'x1', '10']
    """
    if len(tokens) != 4:
      raise ValueError(f"SRAI instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'srai':
      raise ValueError(f"Expected 'srai' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return SRAI(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SRAI (Shift Right Arithmetic Immediate)
    dIdx = aIdx >> imm (arithmetic shift - sign bit preserved)
    """
    aVal = state.regs[self.aIdx].value
    immVal = self.imm & 0x1F  # Mask to 5 bits (0-31)

    # Convert to signed, shift, convert back to unsigned
    aValSigned = aVal if aVal < 2**31 else aVal - 2**32
    resultSigned = aValSigned >> immVal
    
    state.regs[self.dIdx].value = resultSigned % (2 ** 32)

    return state

class BEQ(Instruction):
  def __init__(self, aIdx, bIdx, imm):
    self.aIdx = aIdx
    self.bIdx = bIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'beq'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'BEQ':
    """
    Parse BEQ instruction from tokens.
    Expected format: ['beq', 'x1', 'x2', 'imm']
    """
    if len(tokens) != 4:
      raise ValueError(f"BEQ instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'beq':
      raise ValueError(f"Expected 'beq' instruction, got '{tokens[0]}'")
    
    aIdx = checkRegister(tokens[1])
    bIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return BEQ(aIdx, bIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of BEQ (Branch Equal)
    If aIdx == bIdx, branch to PC + imm
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    if aVal == bVal:
      state.isJumping = True
      state.jumpOffset = self.imm

    return state

class BNE(Instruction):
  def __init__(self, aIdx, bIdx, imm):
    self.aIdx = aIdx
    self.bIdx = bIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'bne'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'BNE':
    """
    Parse BNE instruction from tokens.
    Expected format: ['bne', 'x1', 'x2', 'imm']
    """
    if len(tokens) != 4:
      raise ValueError(f"BNE instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'bne':
      raise ValueError(f"Expected 'bne' instruction, got '{tokens[0]}'")
    
    aIdx = checkRegister(tokens[1])
    bIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return BNE(aIdx, bIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of BNE (Branch Not Equal)
    If aIdx != bIdx, branch to PC + imm
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    if aVal != bVal:
      state.isJumping = True
      state.jumpOffset = self.imm

    return state

class BLT(Instruction):
  def __init__(self, aIdx, bIdx, imm):
    self.aIdx = aIdx
    self.bIdx = bIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'blt'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'BLT':
    """
    Parse BLT instruction from tokens.
    Expected format: ['blt', 'x1', 'x2', 'imm']
    """
    if len(tokens) != 4:
      raise ValueError(f"BLT instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'blt':
      raise ValueError(f"Expected 'blt' instruction, got '{tokens[0]}'")
    
    aIdx = checkRegister(tokens[1])
    bIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return BLT(aIdx, bIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of BLT (Branch Less Than)
    If aIdx < bIdx (signed), branch to PC + imm
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    # Convert to signed for comparison
    aValSigned = aVal if aVal < 2**31 else aVal - 2**32
    bValSigned = bVal if bVal < 2**31 else bVal - 2**32

    if aValSigned < bValSigned:
      state.isJumping = True
      state.jumpOffset = self.imm

    return state

class BGE(Instruction):
  def __init__(self, aIdx, bIdx, imm):
    self.aIdx = aIdx
    self.bIdx = bIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'bge'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'BGE':
    """
    Parse BGE instruction from tokens.
    Expected format: ['bge', 'x1', 'x2', 'imm']
    """
    if len(tokens) != 4:
      raise ValueError(f"BGE instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'bge':
      raise ValueError(f"Expected 'bge' instruction, got '{tokens[0]}'")
    
    aIdx = checkRegister(tokens[1])
    bIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return BGE(aIdx, bIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of BGE (Branch Greater or Equal)
    If aIdx >= bIdx (signed), branch to PC + imm
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    # Convert to signed for comparison
    aValSigned = aVal if aVal < 2**31 else aVal - 2**32
    bValSigned = bVal if bVal < 2**31 else bVal - 2**32

    if aValSigned >= bValSigned:
      state.isJumping = True
      state.jumpOffset = self.imm

    return state

class LW(Instruction):
  def __init__(self, dIdx, aIdx, imm):
    self.dIdx = dIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'lw'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'LW':
    """
    Parse LW instruction from tokens.
    Expected format: ['lw', 'x0', '10(x1)'] or ['lw', 'x0', 'x1', '10']
    """
    if len(tokens) not in (3, 4):
      raise ValueError(
        f"LW instruction expects 3 or 4 tokens, got {len(tokens)}: {tokens}"
      )
    
    if tokens[0].lower() != 'lw':
      raise ValueError(f"Expected 'lw' instruction, got '{tokens[0]}'")
    
    dIdx = checkRegister(tokens[1])
    aIdx, imm = parseLoadStoreAddressTokens(tokens[2:])
    
    return LW(dIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of LW (Load Word).
    lw rd, offset(rs1)
    """
    aVal = state.regs[self.aIdx].value
    addr = (aVal + self.imm) % (2 ** 32)

    if addr % 4 != 0:
      raise ValueError(f"Unaligned word access: address {addr} is not divisible by 4")

    # Load 4 bytes from memory (little-endian)
    if addr + 3 >= len(state.memory):
      raise ValueError(f"Memory access out of bounds: address {addr} + 3 >= {len(state.memory)}")
    
    byte0 = state.memory[addr].value
    byte1 = state.memory[addr + 1].value
    byte2 = state.memory[addr + 2].value
    byte3 = state.memory[addr + 3].value

    # Combine bytes in little-endian order
    word = byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24)

    state.regs[self.dIdx].value = word

    return state

class BLTU(Instruction):
  def __init__(self, aIdx, bIdx, imm):
    self.aIdx = aIdx
    self.bIdx = bIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'bltu'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'BLTU':
    """
    Parse BLTU instruction from tokens.
    Expected format: ['bltu', 'x1', 'x2', 'imm']
    """
    if len(tokens) != 4:
      raise ValueError(f"BLTU instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'bltu':
      raise ValueError(f"Expected 'bltu' instruction, got '{tokens[0]}'")
    
    aIdx = checkRegister(tokens[1])
    bIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])
    
    return BLTU(aIdx, bIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of BLTU (Branch Less Than Unsigned)
    If aIdx < bIdx (unsigned), branch to PC + imm
    """
    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    # Direct unsigned comparison - no conversion needed
    if aVal < bVal:
      state.isJumping = True
      state.jumpOffset = self.imm

    return state

class BGEU(Instruction):
  def __init__(self, aIdx, bIdx, imm):
    self.aIdx = aIdx
    self.bIdx = bIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'bgeu'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'BGEU':
    """
    Parse BGEU instruction from tokens.
    Expected format: ['bgeu', 'x1', 'x2', 'imm']
    """
    if len(tokens) != 4:
      raise ValueError(f"BGEU instruction expects 4 tokens, got {len(tokens)}: {tokens}")
    
    if tokens[0].lower() != 'bgeu':
      raise ValueError(f"Expected 'bgeu' instruction, got '{tokens[0]}'")
    
    aIdx = checkRegister(tokens[1])
    bIdx = checkRegister(tokens[2])
    imm = checkImmediate(tokens[3])

    return BGEU(aIdx, bIdx, imm)

  def forward(self, state : MachineState) -> MachineState:

    """
    Implements the forward pass of BGEU (Branch Greater or Equal Unsigned)
    If aIdx >= bIdx (unsigned), branch to PC + imm
    """

    aVal = state.regs[self.aIdx].value
    bVal = state.regs[self.bIdx].value

    # Direct unsigned comparison - no conversion needed
    if aVal >= bVal:
      state.isJumping = True
      state.jumpOffset = self.imm

    return state

class SW(Instruction):
  def __init__(self, sIdx, aIdx, imm):
    self.sIdx = sIdx
    self.aIdx = aIdx
    self.imm = imm

  @staticmethod
  def getName() -> str:
    return 'sw'

  @staticmethod
  def parseFromSourceTokens(tokens: List[str]) -> 'SW':
    """
    Parse SW instruction from tokens.
    Expected format: ['sw', 'x2', '10(x1)'] or ['sw', 'x2', 'x1', '10']
    Stores word from x2 to memory[x1 + 10].
    """
    if len(tokens) not in (3, 4):
      raise ValueError(
        f"SW instruction expects 3 or 4 tokens, got {len(tokens)}: {tokens}"
      )
    
    if tokens[0].lower() != 'sw':
      raise ValueError(f"Expected 'sw' instruction, got '{tokens[0]}'")
    
    sIdx = checkRegister(tokens[1])
    aIdx, imm = parseLoadStoreAddressTokens(tokens[2:])
    
    return SW(sIdx, aIdx, imm)

  def forward(self, state : MachineState) -> MachineState:
    """
    Implements the forward pass of SW (Store Word).
    sw rs2, offset(rs1)
    """
    sVal = state.regs[self.sIdx].value
    aVal = state.regs[self.aIdx].value
    addr = (aVal + self.imm) % (2 ** 32)

    if addr % 4 != 0:
      raise ValueError(f"Unaligned word access: address {addr} is not divisible by 4")

    # Normal memory write
    if addr + 3 >= len(state.memory):
      raise ValueError(f"Memory access out of bounds: address {addr} + 3 >= {len(state.memory)}")

    state.memory[addr].value = sVal & 0xFF
    state.memory[addr + 1].value = (sVal >> 8) & 0xFF
    state.memory[addr + 2].value = (sVal >> 16) & 0xFF
    state.memory[addr + 3].value = (sVal >> 24) & 0xFF

    return state
