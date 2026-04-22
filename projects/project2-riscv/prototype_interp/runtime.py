from typing import List, Optional
from copy import deepcopy

from instructions import Instruction
from machine import MachineState

class Runtime:
  def __init__(self, program : List[Instruction], initialState : Optional[MachineState] = None):
    # Initialize the machine state
    # with a default or provided initial state
    if initialState is not None:
      self.states = [initialState]
    else:
      self.states = [MachineState()]

    self.program = program
    
  def step(self) -> MachineState:
    """
    Given our current state of the machine,
    runs one step forward, and then returns that
    new state, while also updating the internal
    state of the machine 
    """
    assert len(self.states) > 0, "No machine state available"

    currState = deepcopy(self.states[-1])

    # Check if the program counter is valid
    if currState.pc < 0:
      raise ValueError("Program counter below 0")
    elif currState.pc >= len(self.program):
      return currState  # No more instructions to run
    
    # Run the next instruction
    instruction = self.program[currState.pc]
    new_state = instruction.forward(currState)

    if not new_state.isJumping:
      new_state.pc += 1
    else:
      new_state.pc += new_state.jumpOffset
      new_state.isJumping = False
      new_state.jumpOffset = 0

    self.states.append(new_state)
    return new_state

  def run(self) -> MachineState:
    """
    Runs the program to completion,
    returning the final machine state
    """
    while True:
      priorState = self.states[-1]
      nextState = self.step()

      # If we have ended, exactly the same object
      if not nextState.isJumping and priorState.pc == nextState.pc:
        break

    return self.states[-1]
