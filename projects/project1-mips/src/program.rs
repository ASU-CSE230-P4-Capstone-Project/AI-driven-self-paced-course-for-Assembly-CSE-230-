use std::collections::HashMap;
use crate::instruction::{Instruction};
use crate::instruction::CoreInstruction;
use crate::memory::*;
use crate::assembler::Assembler;
use crate::memory::Memory;

/// enum used to indicate a runtime emulation error (e.g. parsing error)
#[derive(Debug, Clone)]
pub enum EmuError {
    /// indicates an error with instruction syntax 
    ParsingError(String),
    
    /// indicates an error with provided register 
    InvalidReg(String),

    /// indicates an invalid immediate when parsing 
    InvalidImm(String),

    /// indicates unaligned memory access during runtime execution
    UnalignedAccess(u32),

    /// indicates invalid jump target during runtime 
    InvalidJump(u32),

    /// indicates a label that does not exist 
    UndefinedLabel(String),

    /// indicates a MIPS calling convention violation
    CallingConventionViolation(String),

    /// indicates the program exceeded maximum instruction execution limit
    ExecutionLimitExceeded(u64),

    /// indicates emulation termination
    Termination,

    /// indicates instruction breakpoint
    Breakpoint,

    // when dividing by zero
    DivideByZero  
}

/// structure used to hold a list of Instructions
#[derive(Debug, Clone)]
pub struct Program {
    /// list of `CoreInstruction` 
    pub core_instructions: Vec<CoreInstruction>,

    /// mapping from label to line number 
    pub symbol_table: HashMap<String, u32>,

    // list of line numbers 
    pub line_numbers: Vec<usize>
}  

impl Program {
    pub fn parse(src: &str, memory: &mut Memory) -> Result<Self, EmuError> {
        let mut assembler = Assembler::new();
        
        match assembler.assemble(src, memory) {
            Ok((core_instructions, symbol_table, line_numbers)) => {
                Ok(Program {
                    core_instructions,
                    symbol_table,
                    line_numbers
                })
            },
            Err(e) => {
                Err(e)
            }
        }
    }

    /// get the line number for a label 
    pub fn get_label_address(&self, label: &str) -> Option<u32> {
        self.symbol_table.get(label).copied()
    }

    /// convert $pc to an index to an instruction in the instruction array 
    pub fn pc_to_index(&self, pc: u32) -> Option<usize> {
        if pc < DEFAULT_TEXT_BASE_ADDRESS {
            return None;
        }

        // check alignment since $pc is 4-byte aligned
        let offset: u32 = pc - DEFAULT_TEXT_BASE_ADDRESS;
        if offset % 4 != 0 {
            return None; 
        }

        let index: usize = (offset / 4) as usize;
        if index < self.core_instructions.len() {
            Some(index)
        } else {
            None
        }
    }

    /// get the $pc for an index in the instruction array 
    pub fn index_to_pc(&self, index: usize) -> u32 {
        DEFAULT_TEXT_BASE_ADDRESS + (index as u32 * 4)
    }
}