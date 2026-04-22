# Testing out instructions
import random

from instructions import Instruction, ADD, ADDI, XOR, XORI, OR, ORI, AND, ANDI
from machine import MachineState, Runtime

def test_add():
  """
  Testing the add, and addi instructions
  """
  a, b = random.randint(0, 1000), random.randint(0, 1000)
  c = (a + b) % (2 ** 32)

  # Now, seed x1 and x2 to those
  state = MachineState()
  state.regs[1].value = a
  state.regs[2].value = b

  # Create an add instruction
  add = ADD.parseFromString("ADD x3, x1, x2")
  afterAdd = add.forward(state)

  # Check that x3 is now c
  assert afterAdd.regs[3].value == c, f"Expected {c}, got {afterAdd.regs[3].value}"

def test_addi():
  """
  Testing the addi instruction
  """
  a, b = random.randint(0, 1000), random.randint(0, 1000)
  c = (a + b) % (2 ** 32)

  state = MachineState()
  state.regs[1].value = a
  state.regs[2].value = b

  addi = ADDI.parseFromString(f"ADDI x3, x1, {b}")
  afterAddi = addi.forward(state)

  assert afterAddi.regs[3].value == c, f"Expected {c}, got {afterAddi.regs[3].value}"

def test_xor():
  """
  Testing the XOR, and XORI instructions
  """
  a, b = random.randint(0, 1000), random.randint(0, 1000)
  c = (a ^ b)

  # Now, seed x1 and x2 to those
  state = MachineState()
  state.regs[1].value = a
  state.regs[2].value = b

  # Create an add instruction
  xor = XOR.parseFromString("XOR x3, x1, x2")
  afterXor = xor.forward(state)

  # Check that x3 is now c
  assert afterXor.regs[3].value == c, f"Expected {c}, got {afterXor.regs[3].value}"

def test_xori():
  """
  Testing the XORI instruction
  """
  a, b = random.randint(0, 1000), random.randint(0, 1000)
  c = (a ^ b)

  state = MachineState()
  state.regs[1].value = a
  state.regs[2].value = b

  xori = XORI.parseFromString(f"XORI x3, x1, {b}")
  afterXori = xori.forward(state)

  assert afterXori.regs[3].value == c, f"Expected {c}, got {afterXori.regs[3].value}"

def test_or():
  """
  Testing the OR, and ORI instructions
  """
  a, b = random.randint(0, 1000), random.randint(0, 1000)
  c = (a | b)

  # Now, seed x1 and x2 to those
  state = MachineState()
  state.regs[1].value = a
  state.regs[2].value = b

  # Create an add instruction
  or_test = OR.parseFromString("OR x3, x1, x2")
  afterOr = or_test.forward(state)

  # Check that x3 is now c
  assert afterOr.regs[3].value == c, f"Expected {c}, got {afterOr.regs[3].value}"

def test_ori():
  """
  Testing the ORI instruction
  """
  a, b = random.randint(0, 1000), random.randint(0, 1000)
  c = (a | b)

  state = MachineState()
  state.regs[1].value = a
  state.regs[2].value = b

  ori = ORI.parseFromString(f"ORI x3, x1, {b}")
  afterOri = ori.forward(state)

  assert afterOri.regs[3].value == c, f"Expected {c}, got {afterOri.regs[3].value}"

def test_and():
  """
  Testing the AND, and ANDI instructions
  """
  a, b = random.randint(0, 1000), random.randint(0, 1000)
  c = (a & b)

  # Now, seed x1 and x2 to those
  state = MachineState()
  state.regs[1].value = a
  state.regs[2].value = b

  # Create an add instruction
  and_test = AND.parseFromString("AND x3, x1, x2")
  afterAnd = and_test.forward(state)

  # Check that x3 is now c
  assert afterAnd.regs[3].value == c, f"Expected {c}, got {afterAnd.regs[3].value}"

def test_andi():
  """
  Testing the addi instruction
  """
  a, b = random.randint(0, 1000), random.randint(0, 1000)
  c = (a & b)

  state = MachineState()
  state.regs[1].value = a
  state.regs[2].value = b

  andi = ANDI.parseFromString(f"ANDI x3, x1, {b}")
  afterAndi = andi.forward(state)

  assert afterAndi.regs[3].value == c, f"Expected {c}, got {afterAndi.regs[3].value}"
  
def test_runtime():
  """
  Testing the runtime
  """
  program = [
    ORI.parseFromString("ORI x1, x0, 5"),
    ORI.parseFromString("ORI x2, x0, 3"),
    ADD.parseFromString("ADD x3, x1, x2")
  ]
  
  runtime = Runtime(program)
  
  runtime.forward()