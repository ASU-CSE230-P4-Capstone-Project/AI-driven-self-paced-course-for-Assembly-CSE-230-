use crate::instruction::CoreInstruction;
use crate::memory::*;
use crate::program::{EmuError, Program};
use crate::Snapshot;
use std::collections::{HashMap, HashSet};

// use crate::lexer::alert;

pub struct CPU { 
    // processor state 
    registers: HashMap<String, u32>,
    
    // special registers that can't be directly accessed 
    pub pc: u32,
    lo: u32,
    hi: u32, 

    // program + memory
    program: Option<Program>,
    pub memory: Memory,     

    // line numbers of instructions containing breakpoints (indicated in the UI)
    pub breakpoints: HashSet<usize>,

    // stack to validate saved registers for procedure execution
    pub validation_stack: Vec<HashMap<String, u32>>,

    // record the last memory read/write to update memory UI
    pub last_mem_access: Option<(u32, u32)>,

    // maximum number of instructions before halting
    pub max_instructions: u64
}

impl CPU {
    pub fn get_lo(&self) -> u32 { self.lo}
    pub fn get_hi(&self) -> u32 { self.hi}
    pub fn new() -> Self {
        CPU { 
            registers: Self::create_register_map(), 
            pc: DEFAULT_TEXT_BASE_ADDRESS,  
            lo: 0,
            hi: 0,
            program: None, 
            memory: Memory::new(),
            breakpoints: HashSet::new(),
            validation_stack: Vec::new(),
            last_mem_access: None,
            max_instructions: 1_000_000
        }
    }

    fn create_register_map() -> HashMap<String, u32> {
        let mut registers: HashMap<String, u32> = HashMap::new();
        // $pc should be modified by accessing `self.pc`

        // general purpose
        registers.insert("$zero".to_string(), 0);
        registers.insert("$at".to_string(), 0);
        registers.insert("$v0".to_string(), 0);
        registers.insert("$v1".to_string(), 0);
        registers.insert("$a0".to_string(), 0);
        registers.insert("$a1".to_string(), 0);
        registers.insert("$a2".to_string(), 0);
        registers.insert("$a3".to_string(), 0);
        registers.insert("$t0".to_string(), 0);
        registers.insert("$t1".to_string(), 0);
        registers.insert("$t2".to_string(), 0);
        registers.insert("$t3".to_string(), 0);
        registers.insert("$t4".to_string(), 0);
        registers.insert("$t5".to_string(), 0);
        registers.insert("$t6".to_string(), 0);
        registers.insert("$t7".to_string(), 0);
        registers.insert("$s0".to_string(), 0);
        registers.insert("$s1".to_string(), 0);
        registers.insert("$s2".to_string(), 0);
        registers.insert("$s3".to_string(), 0);
        registers.insert("$s4".to_string(), 0);
        registers.insert("$s5".to_string(), 0);
        registers.insert("$s6".to_string(), 0);
        registers.insert("$s7".to_string(), 0);
        registers.insert("$t8".to_string(), 0);
        registers.insert("$t9".to_string(), 0);
        registers.insert("$k0".to_string(), 0);
        registers.insert("$k1".to_string(), 0);
        registers.insert("$ra".to_string(), 0);

        // special
        registers.insert("$gp".to_string(), DEFAULT_STATIC_DATA_BASE_ADDRESS);
        registers.insert("$sp".to_string(), DEFAULT_STACK_POINTER); 
        registers.insert("$fp".to_string(), DEFAULT_STACK_BASE_ADDRESS); 

        registers
    }

    /// returns the value of a register as a 32-bit unsigned integer
    pub fn get_reg(&self, name: &str) -> u32 {
        *self.registers.get(name).unwrap_or(&0)
    }

    /// sets a register value to a 32-bit unsigned integer 
    pub fn set_reg(&mut self, name: &str, value: u32) {
        self.registers.insert(name.to_string(), value);
    }

    pub fn load_program(&mut self, program: Program) {
        self.program = Some(program);
        self.pc = DEFAULT_TEXT_BASE_ADDRESS;
    }

    pub fn execute(&mut self, insn: &CoreInstruction) -> Result<(), EmuError> {
        let mut is_branch = false;
        
        // handle instruction based on type
        match insn {
            CoreInstruction::Add { rd, rs, rt } => {
                let r1 = self.get_reg(rs) as i32; 
                let r2 = self.get_reg(rt) as i32;
                
                self.set_reg(rd, r1.wrapping_add(r2) as u32);
            },

            CoreInstruction::Addi { rt, rs, imm } => {
                let r = self.get_reg(rs) as i32;
                self.set_reg(rt, r.wrapping_add(*imm) as u32);
            },

            CoreInstruction::Addiu { rt, rs, imm } => {
                let r = self.get_reg(rs) as i32;
                self.set_reg(rt, r.wrapping_add(*imm as i32) as u32);
            },

            CoreInstruction::Addu { rd, rs, rt } => {
                let r1 = self.get_reg(rs);
                let r2 = self.get_reg(rt);
                self.set_reg(rd,r1.wrapping_add(r2));
            },   

            CoreInstruction::Sub { rd, rs, rt } => {
                let r1 = self.get_reg(rs) as i32;
                let r2 = self.get_reg(rt) as i32;

                self.set_reg(rd, r1.wrapping_sub(r2) as u32);
            },

            CoreInstruction::Subu { rd, rs, rt } => {
                let r1 = self.get_reg(rs) as u32;
                let r2 = self.get_reg(rt) as u32;

                self.set_reg(rd, r1.wrapping_sub(r2) as u32);
            },

            CoreInstruction::Lw { rt, rs, imm } => {
                let base = self.get_reg(rs);
                let addr = base.wrapping_add(*imm as u32);

                if addr % 4 != 0 {
                    return Err(EmuError::UnalignedAccess(addr));
                }

                let val = self.memory.load_word(addr);   // load 4 bytes starting at addr
                self.set_reg(rt, val as u32);
                
                self.last_mem_access = Some((addr, 4));
            },

            CoreInstruction::Sw { rs, rt, imm } => {
                let base = self.get_reg(rs);
                let addr = base.wrapping_add(*imm as u32);

                // would only allow multiples of 4 to be input numbers 
                if addr % 4 != 0  {
                   return Err(EmuError::UnalignedAccess(addr)); 
                }

                let val = self.get_reg(rt) as i32;
                self.memory.set_word(addr, val);

                self.last_mem_access = Some((addr, 4));
            },

            CoreInstruction::Lui { rt, imm } => {
                self.set_reg(rt, imm << 16);
            },

            CoreInstruction::Lb { rt, rs, imm } => {
                let base = self.get_reg(rs);
                let addr = base.wrapping_add(*imm as u32);
                let val = self.memory.load_byte(addr);
                
                self.set_reg(rt, val as u32);
                self.last_mem_access = Some((addr, 1));
            },

            CoreInstruction::Sb { rs, rt, imm } => {
                let base = self.get_reg(rs);
                let addr = base.wrapping_add(*imm as u32);
                let val = self.get_reg(rt)as i8;

                self.memory.set_byte(addr, val);
                self.last_mem_access = Some((addr, 1));
            },

            CoreInstruction::Lh { rt, rs, imm } => {
                let base = self.get_reg(rs);
                let addr = base.wrapping_add(*imm as u32);
                let val = self.memory.load_halfword(addr);

                self.set_reg(rt, val as u32);
                self.last_mem_access = Some((addr, 2));
            },

            CoreInstruction::Sh { rt, rs, imm } => {
                let base = self.get_reg(rs);
                let addr = base.wrapping_add(*imm as u32);
                let val = self.get_reg(rt)as i16;

                self.memory.set_halfword(addr, val);
                self.last_mem_access = Some((addr, 2));
            },

            CoreInstruction::J { label } => {
                let target = self.program.as_ref()
                    .unwrap()
                    .get_label_address(label)
                    .ok_or(EmuError::UndefinedLabel(label.clone()))?;

                self.pc = target;
                is_branch = true;

                // alert(format!("Jumping to address: 0x{:08X}", target).as_str());
            },

            CoreInstruction::Jal { label } => {
                // create snapshot of registers for stack validation
                let mut snapshot = HashMap::new();
                snapshot.insert("$sp".to_string(), self.get_reg("$sp"));
                snapshot.insert("$fp".to_string(), self.get_reg("$fp"));

                for i in 0..=7 {
                    let reg_name = format!("$s{}", i);
                    snapshot.insert(reg_name.clone(), self.get_reg(&reg_name));
                }
                self.validation_stack.push(snapshot);

                // jump and set $ra register
                let return_addr = self.pc + 4;
                self.set_reg("$ra", return_addr);

                let target = self.program.as_ref()
                    .unwrap()
                    .get_label_address(label)
                    .unwrap();

                self.pc = target;
                is_branch = true; 
            },

            CoreInstruction::Jr { rs } => {
                // validate the snapshop of stack registers from our snapshot
                if rs == "$ra" {
                    if let Some(snapshot) = self.validation_stack.pop() {
                        
                        // check $sp
                        let current_sp = self.get_reg("$sp");
                        if current_sp != snapshot["$sp"] {
                            return Err(EmuError::CallingConventionViolation(
                                format!("stack pointer $sp not restored. Expected 0x{:x}, found 0x{:x}", snapshot["$sp"], current_sp)
                            ));
                        }
                        
                        // check $fp
                        let current_fp = self.get_reg("$fp");
                        if current_fp != snapshot["$fp"] {
                            return Err(EmuError::CallingConventionViolation(
                                format!("frame pointer $fp not restored. Expected 0x{:x}, found 0x{:x}", snapshot["$fp"], current_fp)
                            ));
                        }
                        
                        // lab 12.15 violates the saved register convention
                        // usually registers like $s0 must be preserved after a function call

                        // check $s0 through $s7 registers
                        // for i in 0..=7 {
                        //     let reg_name = format!("$s{}", i);
                        //     let current_val = self.get_reg(&reg_name);
                        //     let snapshot_val = snapshot[&reg_name];

                        //     if current_val != snapshot_val {
                        //         return Err(EmuError::CallingConventionViolation(
                        //             format!("callee-saved register {} not restored. Expected 0x{:x}, found 0x{:x}", reg_name, snapshot_val, current_val)
                        //         ));
                        //     }
                        // }
                    }
                }

                let target = self.get_reg(rs);
                
                // check if 4-byte aligned
                if target % 4 != 0 {
                    return Err(EmuError::UnalignedAccess(target));
                }
            
                // check if $pc maps to some instruction in the array 
                if let Some(program) = &self.program {
                    if program.pc_to_index(target).is_none() {
                        return Err(EmuError::InvalidJump(target));
                    }
                }
            
                self.pc = target;
                is_branch = true;
            },

            CoreInstruction::Or {rd, rs, rt } => {
                let r1 = self.get_reg(rs);
                let r2 = self.get_reg(rt);
                self.set_reg(rd, r1 | r2);
            },

            CoreInstruction::Ori {rt, rs, imm} => {
                let r = self.get_reg(rs);
                self.set_reg(rt, r | *imm);
            },

            CoreInstruction::And { rd, rs, rt } => {
                let r1 = self.get_reg(rs);
                let r2 = self.get_reg(rt);
                self.set_reg(rd, r1 & r2);
            },

            CoreInstruction::Xor { rd, rs, rt } => {
                let val = self.get_reg(rs) ^ self.get_reg(rt);
                self.set_reg(rd, val)
            },

            CoreInstruction::Xori { rt, rs, imm } => {
              let val = self.get_reg(rs) ^ imm;
              self.set_reg(rt, val)
            },

            CoreInstruction::Andi { rt, rs, imm } => {
                let r = self.get_reg(rs);
                self.set_reg(rt, r & *imm);
            },

            CoreInstruction::Beq { rs, rt, label } => {
                let r1 = self.get_reg(rs);
                let r2 = self.get_reg(rt);

                if r1 == r2 {
                    let target = self.program.as_ref()
                        .unwrap()
                        .get_label_address(label)
                        .ok_or(EmuError::UndefinedLabel(label.clone()))?;
                    
                    self.pc = target;
                    is_branch = true;
                }
            },

            CoreInstruction::Bne { rs, rt, label } => {
                let r1 = self.get_reg(rs);
                let r2 = self.get_reg(rt);

                if r1 != r2 {
                    let target = self.program.as_ref()
                        .unwrap()
                        .get_label_address(label)
                        .ok_or(EmuError::UndefinedLabel(label.clone()))?;
                    
                    self.pc = target;
                    is_branch = true;
                }
            },

            CoreInstruction::Slt { rd, rs, rt } => {
                let r1 = self.get_reg(rs) as i32;
                let r2 = self.get_reg(rt) as i32;

                if r1 < r2 {
                    self.set_reg(rd, 1);
                } else {
                    self.set_reg(rd, 0);
                }
            },

            CoreInstruction::Slti {rt, rs, imm } => {
                let r = self.get_reg(rs) as i32;
                self.set_reg(rt, if r< *imm { 1 } else {0});
            },

            CoreInstruction::Sltu {rd, rs, rt } => {
                let r1 = self.get_reg(rs);
                let r2 = self.get_reg(rt);
                self.set_reg(rd, if r1<r2 { 1 } else {0});
            },

            CoreInstruction::Sltiu {rt, rs, imm } => {
                let r = self.get_reg(rs);
                self.set_reg(rt, if r< (*imm as u32) { 1 } else {0});
            },
            
            CoreInstruction::Mult { rs, rt } => {
                let r1 = self.get_reg(rs) as i32 as i64;
                let r2 = self.get_reg(rt) as i32 as i64;
                
                let result = r1.wrapping_mul(r2);

                // store the low 32 bits in lo and high 32 bits in hi
                self.lo = (result & 0xFFFFFFFF) as u32;
                self.hi = ((result >> 32) & 0xFFFFFFFF) as u32;
            },

            // this implementation treats the operands as unsigned instead of signed
            // this matches ZyBooks/ZyLabs but is "technically" incorrect
            // CoreInstruction::Mult { rs, rt } => {
            //     let r1 = self.get_reg(rs) as u64;
            //     let r2 = self.get_reg(rt) as u64;
                
            //     let result = r1.wrapping_mul(r2);

            //     self.lo = (result & 0xFFFFFFFF) as u32;
            //     self.hi = ((result >> 32) & 0xFFFFFFFF) as u32;
            // },

            CoreInstruction::Mfhi { rd } => {
                self.set_reg(rd, self.hi);
            },

            CoreInstruction::Mflo { rd } => {
                self.set_reg(rd, self.lo);
            },

            CoreInstruction::Div {rs, rt} => {
                let dividend = self.get_reg(rs) as i32;
                let divisor = self.get_reg(rt) as i32;

                if divisor == 0 {
                    return Err(EmuError::DivideByZero); // add error to emuerro
                }

                self.lo = (dividend / divisor) as u32;
                self.hi = (dividend % divisor) as u32;
            },

            CoreInstruction::Nor{ rd, rs, rt } => {
                let r1 = self.get_reg(rs);
                let r2 = self.get_reg(rt);

                self.set_reg(rd, !(r1 | r2));
            },

            CoreInstruction::Sll {rd, rt, sa } => {
                let v = self.get_reg(&rt);
                self.set_reg(&rd, v << sa);
            },

            CoreInstruction::Srl { rd, rt, sa} =>{
                let v = self.get_reg(&rt);
                self.set_reg(&rd, v >> sa);
            },

            CoreInstruction::Sra { rd, rt, imm } => {
                let v = self.get_reg(rt) as i32;        // interpret as signed
                let result = v >> imm;                       // arithmetic shift
                self.set_reg(rd, result as u32);      // store back as u32
            },

            CoreInstruction::Multu { rs, rt } => {
                let r1 = self.get_reg(rs) as u64;
                let r2 = self.get_reg(rt) as u64;

                let res = r1 * r2;
                self.lo = (res & 0xFFFF_FFFF) as u32;
                self.hi = (res >> 32) as u32;
            },

            CoreInstruction::Divu { rs, rt } => {
                let r1 = self.get_reg(rs);
                let r2 = self.get_reg(rt);

                if r2 != 0 {
                    self.lo = r1 / r2;
                    self.hi = r1 % r2;
                }
            }
        }        

        // branch instructions will modify the PC to another address instead of the sequential instruction
        // maybe we have to deal with the one instruction leading to jr $ra due to branch delay
        if !is_branch {
            self.pc += 4;
        }

        Ok(())
    }

    /// executes a single MIPS instruction 
    pub fn next(&mut self) -> Result<(), EmuError> {
        let program = self.program.as_ref().unwrap();
        self.last_mem_access = None;

        // get the current instruction using the $pc register
        // we could iterate the array but this is better when we also deal with branches and jumps 
        let index = program.pc_to_index(self.pc)
            .ok_or(EmuError::Termination)?;

        let insn = program.core_instructions[index].clone();
        // alert(format!("Executing instruction: {:?} at PC: 0x{:08X}", insn, self.pc).as_str());
        self.execute(&insn)?;

        Ok(())
    }

    /// launches the emulator instance and executes line-by-line using a `Program`
    pub fn run(&mut self) -> Result<(), EmuError> {
        let mut instruction_count: u64 = 0;

        loop {
            if self.max_instructions > 0 && instruction_count >= self.max_instructions {
                return Err(EmuError::ExecutionLimitExceeded(instruction_count));
            }

            match self.next() {
                Ok(_) => {},
                Err(EmuError::Termination) => break,
                Err(EmuError::Breakpoint) => return Err(EmuError::Breakpoint),
                Err(e) => return Err(e)
            }

            instruction_count += 1;

            // check if the current instruction line contains a breakpoint in the set
            if let Some(program) = self.program.as_ref() {
                if let Some(index) = program.pc_to_index(self.pc) {
                    if index < program.line_numbers.len() {
                        let current_line = program.line_numbers[index] - 1;

                        if self.breakpoints.contains(&current_line) {
                            return Err(EmuError::Breakpoint);
                        }
                    }
                }
            }
        }   

        Ok(())
    }   

    /// used to run a multiline string directly 
    pub fn run_input(&mut self, source: &str) -> Result<(), EmuError> {
        let program = Program::parse(source, &mut self.memory)?;

        self.load_program(program);
        self.run()
    }

    pub fn set_breakpoints(&mut self, lines: Vec<usize>) {
        self.breakpoints = lines.into_iter().collect();
    }

    // below functions are used for Web Assembly only
    pub fn reset(&mut self) {
        self.registers = Self::create_register_map();

        // enable memory isolation by default
        self.memory = Memory::new(); 
        self.pc = DEFAULT_TEXT_BASE_ADDRESS;

        self.lo = 0;
        self.hi = 0;
        self.program = None;

        self.breakpoints.clear();
        self.validation_stack.clear();
    }

    pub fn snapshot(&self) -> Snapshot {
        let (addr, size) = match self.last_mem_access {
            Some((a, s)) => (Some(a), Some(s)),
            None => (None, None),
        };

        Snapshot {
            registers: self.registers.clone(),
            memory_access_addr: addr,
            memory_access_size: size,
            mmio: Some(self.memory.mmio.snapshot())
        }
    }

    pub fn get_program(&self) -> Option<&Program> {
        self.program.as_ref()
    }
}