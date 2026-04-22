pub mod assembler;
pub mod cpu;
pub mod instruction;
pub mod lexer;
pub mod memory;
pub mod parser;
pub mod program;
pub mod mmio;

use cpu::CPU;
use program::Program;
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use program::EmuError;
use std::collections::{HashMap, HashSet};
use mmio::DeviceState; 

//https://github.com/insou22/mipsy partial code used since its a rough outline of the code 
// only li add and sub; shows register history as lineis entered (as changed) 

#[derive(Serialize, Deserialize, Default)]
pub struct Snapshot {
    pub registers: HashMap<String, u32>,
    pub memory_access_addr: Option<u32>,
    pub memory_access_size: Option<u32>,
    pub mmio: Option<HashMap<u32, DeviceState>> 
}

#[derive(Serialize, Deserialize)]
pub struct WasmResult {
    error: String,
    snapshot: Option<Snapshot>,
}

#[wasm_bindgen]
pub struct WasmCPU {
    cpu: CPU,
}

#[wasm_bindgen]
impl WasmCPU {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            cpu: CPU::new(),
        }
    }
//added a reset method so it lets the frontend reset the emulator without remaking the WasmCPU
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.cpu.reset()
    }

    //loads t he strings in mips source code as a program(resets the cpu before loading the new program)
    #[wasm_bindgen]
    pub fn load_source(&mut self, source: &str) -> JsValue {
        self.cpu.reset();

        // parse the program then run using provided code from HTML
        match Program::parse(source, &mut self.cpu.memory) {
            Ok(program) => {
                self.cpu.load_program(program);
                //added in 2nd file the old one just did "self.cpu.load_program(program);"
                serde_wasm_bindgen::to_value(&WasmResult {
                    error: String::new(),
                    snapshot: None
                }).unwrap()
            },
            Err(e) => {
                serde_wasm_bindgen::to_value(&WasmResult {
                    error: format!("Syntax Error -- {:?}", e),
                    snapshot: None
                }).unwrap()
            }
        }
    }

    #[wasm_bindgen]
    pub fn set_breakpoints(&mut self, lines: Vec<usize>) {
        self.cpu.set_breakpoints(lines);
    }

    //emulate a single instruction using the MIPS CPU
    #[wasm_bindgen]
    pub fn step(&mut self) -> JsValue {
        match self.cpu.next() {
            Ok(_) => {
                let snap = self.cpu.snapshot();

                serde_wasm_bindgen::to_value(&WasmResult {
                    error: String::new(),
                    snapshot: Some(snap),
                }).unwrap()
            }
            Err(EmuError::Termination) => {
                serde_wasm_bindgen::to_value(&WasmResult {
                    error: "Termination".to_string(),
                    snapshot: Some(self.cpu.snapshot()),
                }).unwrap()
            },
            Err(EmuError::Breakpoint) => {  
                serde_wasm_bindgen::to_value(&WasmResult {
                    error: "Breakpoint".to_string(),
                    snapshot: Some(self.cpu.snapshot()),
                }).unwrap()
            }
            Err(e) => {
                serde_wasm_bindgen::to_value(&WasmResult {
                    error: format!("Runtime Error -- {:?}", e),
                    snapshot: Some(self.cpu.snapshot()),
                }).unwrap()
            }
        }
    }

    //emulate the entire source using the CPU
    #[wasm_bindgen]
    pub fn run(&mut self) -> JsValue {
        match self.cpu.run() {
            Ok(_) => {
                let snapshot = self.cpu.snapshot();
                serde_wasm_bindgen::to_value(&WasmResult {
                    error: "Termination".to_string(),
                    snapshot: Some(snapshot)
                }).unwrap()
            },
            Err(EmuError::Breakpoint) => {
                serde_wasm_bindgen::to_value(&WasmResult {
                    error: "Breakpoint".to_string(),
                    snapshot: Some(self.cpu.snapshot()),
                }).unwrap()
            }
            Err(e) => {
                serde_wasm_bindgen::to_value(&WasmResult {
                    error: format!("Runtime Error -- {:?}", e),
                    snapshot: Some(self.cpu.snapshot()),
                })
                .unwrap()
            }
        }
    }

    /// returns next instruction to be emulated as a string 
    /// this is to provide some additional context in the console (although could be replaced with just $PC register)
    #[wasm_bindgen]
    pub fn next_instruction(&self) -> String {
        let pc = self.cpu.pc;
        if let Some(program) = self.cpu.get_program() {
            if let Some(index) = program.pc_to_index(pc) {
                if index < program.core_instructions.len() {
                    return format!("0x{:08x}: {:?}", pc, program.core_instructions[index]);
                }
            }
        }
        
        //to help the UI know when the next instruction is empty
        "---".to_string()
    }

    // gets the current line number using $PC register (due to mapping)
    #[wasm_bindgen]
    pub fn get_current_line(&self) -> i32 {
        let pc = self.cpu.pc;

        if let Some(program) = self.cpu.get_program() {
            if let Some(index) = program.pc_to_index(pc) {
                if index < program.line_numbers.len() {
                    return (program.line_numbers[index] as i32) - 1;
                }
            }
        }

        -1
    }

    // get a slice of memory from the memory module using the CPU
    #[wasm_bindgen]
    pub fn get_memory(&mut self, start_address: u32, size: usize) -> Vec<u8> {
        self.cpu.memory.get_memory_slice(start_address, size)
    }

    #[wasm_bindgen]
    pub fn get_mmio_state(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.cpu.memory.mmio.snapshot()).unwrap()
    }

    #[wasm_bindgen]
    pub fn set_register(&mut self, name: &str, value: u32) {
        self.cpu.set_reg(name, value);
    }

    #[wasm_bindgen]
    pub fn set_memory_word(&mut self, address: u32, value: i32) {
        self.cpu.memory.set_word(address, value);
    }

    #[wasm_bindgen]
    pub fn set_isolation(&mut self, enabled: bool) {
        if enabled {
            self.cpu.memory.freeze_inputs();
        } else {
            self.cpu.memory.thaw_inputs();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{CPU};

    #[test]
    fn addi_test_1() {
        let mut cpu = CPU::new();
        let program = r#"
            addi $t0, $t0, 5
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t0"), 5);
    }

    #[test]
    fn addiu_test_1() { // multiple inputs 
        let mut cpu = CPU::new();
        let program = r#"
            addiu $t1, $t1, 10
            addiu $t2, $t1, 20
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t1"), 10);
        assert_eq!(cpu.get_reg("$t2"), 30);
    }
    
    #[test]
    fn addu_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li  $t0, 4294967295   # max 32-bit unsigned in decimal
            li  $t1, 2
            addu $t2, $t0, $t1
        "#;

        cpu.run_input(program).unwrap();
        // Unsigned wrap-around: 4294967295 + 2 = 1 (32-bit wrap)
        assert_eq!(cpu.get_reg("$t2"), 1);
    }

    #[test]
    fn subu_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li  $t0, 5
            li  $t1, 10
            subu $t2, $t0, $t1
        "#;

        cpu.run_input(program).unwrap();
        // 5 - 10 = 4294967291 (wrap-around in 32-bit unsigned)
        assert_eq!(cpu.get_reg("$t2"), 4294967291); // 2^32 -1 = 4294967295 <-- unsigned 32 bit integers 
        // 5 - 10 = -5
        // -5 + 2^32 = 4294967291
    }

    #[test]
    fn lw_sw_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li  $t1, 100           # base addr
            li  $t2, 42            # store value
            sw  $t2, 0($t1)        # memory[100] = 42
            lw  $t0, 0($t1)        # load back into t0
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t0"), 42);
    }

        #[test]
    fn lw_sw_overwrite() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 10
            li $t1, 1
            li $t2, 2
            sw $t1, 2($t0)
            sw $t2, 2($t0)
            lw $t3, 2($t0)
        "#;
    
        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t3"), 2);
    }

    #[test]
    fn jr_nested_calls() {
        let mut cpu = CPU::new();
        let program = r#"
            jal func1
            j end
    
            func1:
            addi $sp, $sp, -4
            sw $ra, 0($sp)

            li $t0, 10
            jal func2

            lw $ra, 0($sp)
            addi $sp, $sp, 4
            
            jr $ra
    
            func2:
            addi $t0, $t0, 5
            jr $ra
    
            end:
        "#;
    
        cpu.run_input(program).unwrap();
        // func1 sets $t0=10, func2 adds 5, total = 15
        assert_eq!(cpu.get_reg("$t0"), 15);
    }

    #[test]
    fn jump_test() {
        let mut cpu = CPU::new();
        let program = r#"
            j skip
            addi $t0, $zero, 100

            skip:
            addi $t0, $zero, 50
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t0"), 50); 
    }
    
    #[test]
    fn jal_test() {
        let mut cpu = CPU::new();
        let program = r#"
            start:
            j main
        
            add_five:
            addi $t1, $t0, 5
            jr $ra
        
            main:
            addi $t0, $zero, 10
            jal add_five
            add $t0, $t0, $t1
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t0"), 25); 
    }

        #[test]
    fn or_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li  $t0, 5     # 0b0101
            li  $t1, 8     # 0b1000
            or  $t2, $t0, $t1
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t2"), 13);
    }

    #[test]
    fn ori_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li   $t0, 3     # 0b0011
            ori  $t1, $t0, 12  # 0b1100
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t1"), 15);
    }

    #[test]
    fn beq_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 10
            li $t1, 10
            beq $t0, $t1, skip
            li $t2, 100
            j exit
            skip:
            li $t2, 50
            exit:
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t2"), 50);
    }

    #[test]
    fn bne_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 10
            li $t1, 11
            bne $t0, $t1, skip
            li $t2, 100
            j exit
            skip:
            li $t2, 50
            exit:
        "#;
        
        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t2"), 50);
    }

    #[test]
    fn and_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li  $t0, 13     # 0b1101
            li  $t1, 7      # 0b0111
            and $t2, $t0, $t1
        "#;

        cpu.run_input(program).unwrap();
        // 0b1101 & 0b0111 = 0b0101 = 5
        assert_eq!(cpu.get_reg("$t2"), 5);
    }


    #[test]
    fn andi_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li   $t0, 15      # 0b1111
            andi $t1, $t0, 6  # 0b0110
        "#;

        cpu.run_input(program).unwrap();
        // 0b1111 & 0b0110 = 0b0110 = 6
        assert_eq!(cpu.get_reg("$t1"), 6);
    }



    #[test]
    fn slt_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 5
            li $t1, 10
            slt $t2, $t0, $t1    # 5 < 10 -> 1
            slt $t3, $t1, $t0    # 10 < 5 -> 0
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t2"), 1);
        assert_eq!(cpu.get_reg("$t3"), 0);
    }

    #[test]
    fn slti_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 5
            slti $t1, $t0, 10     # 5 < 10 -> 1
            slti $t2, $t0, 3      # 5 < 3 -> 0
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t1"), 1);
        assert_eq!(cpu.get_reg("$t2"), 0);
    }

    // #[test]
    // fn sltu_test() {
    //     let mut cpu = CPU::new();
    //     let program = r#"
    //         li $t0, 4294967290    # large unsigned
    //         li $t1, 5
    //         sltu $t2, $t0, $t1    # 4294967290 < 5 -> 0
    //         sltu $t3, $t1, $t0    # 5 < 4294967290 -> 1
    //     "#;

    //     cpu.run_input(program).unwrap();
    //     assert_eq!(cpu.get_reg("$t2"), 0);
    //     assert_eq!(cpu.get_reg("$t3"), 1);
    // }

    #[test]
    fn sltiu_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 4294967290
            sltiu $t1, $t0, 4294967295   # 4294967290 < 4294967295 -> 1
            sltiu $t2, $t0, 10            # 4294967290 < 10 -> 0
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t1"), 1);
        assert_eq!(cpu.get_reg("$t2"), 0);
    }

    #[test]
    fn blt_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 5
            li $t1, 10
            blt $t0, $t1, less_than
            li $t2, 100
            j done
        less_than:
            li $t2, 50
        done:
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t2"), 50); // 5 < 10 → branch taken
    }

    #[test]
    fn bge_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 15
            li $t1, 10
            bge $t0, $t1, ge_label
            li $t2, 100
            j done
        ge_label:
            li $t2, 55
        done:
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t2"), 55); // 15 >= 10 → branch taken
    }

    #[test]
    fn ble_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 8
            li $t1, 8
            ble $t0, $t1, less_equal
            li $t2, 200
            j done
        less_equal:
            li $t2, 77
        done:
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t2"), 77); // 8 <= 8 → branch taken
    }

    #[test]
    fn bgt_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 20
            li $t1, 5
            bgt $t0, $t1, greater_than
            li $t2, 123
            j done
        greater_than:
            li $t2, 456
        done:
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t2"), 456); // 20 > 5 → branch taken
    }

    #[test]
    fn pseudo_branch_not_taken_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 3
            li $t1, 9
            bgt $t0, $t1, skip
            li $t2, 222
            j done
        skip:
            li $t2, 999
        done:
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t2"), 222); // 3 > 9 → false, branch NOT taken
    }

    #[test]
    fn move_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 123
            move $t1, $t0
            li $t2, 50
            move $t3, $t2
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_reg("$t1"), 123);
        assert_eq!(cpu.get_reg("$t3"), 50);
    }

    
    #[test]
    fn div_normal_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 20
            li $t1, 3
            div $t0, $t1
        "#;

        cpu.run_input(program).unwrap();
        assert_eq!(cpu.get_lo(), 6);   // quotient
        assert_eq!(cpu.get_hi(), 2);   // remainder
    }

    #[test]
    fn nor_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 5       # 0101
            li $t1, 2       # 0010
            nor $t2, $t0, $t1   # ~(0101 | 0010) = ~(0111)
        "#;

        cpu.run_input(program).unwrap();

        assert_eq!(cpu.get_reg("$t2"), !(5 | 2));
    }

    #[test]
    fn sll_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 5        # 0000...0101
            sll $t1, $t0, 2  # 5 << 2 = 20
        "#;

        cpu.run_input(program).unwrap();

        assert_eq!(cpu.get_reg("$t1"), 5 << 2);
    }

    #[test]
    fn srl_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, 20       # 0000...10100
            srl $t1, $t0, 2  # 20 >> 2 = 5
        "#;

        cpu.run_input(program).unwrap();

        assert_eq!(cpu.get_reg("$t1"), 20 >> 2);
    }

    #[test]
    fn sra_negative_test() {
        let mut cpu = CPU::new();
        let program = r#"
            li $t0, -8
            sra $t1, $t0, 1
        "#;

        cpu.run_input(program).unwrap();

        assert_eq!(cpu.get_reg("$t1"), (-4i32) as u32);
    }

    #[cfg(test)]
    mod tests_divu_multu {
        use super::CPU;

        #[test]
        fn multu_basic_test() {
            let mut cpu = CPU::new();
            let program = r#"
                li $t0, 10
                li $t1, 20
                multu $t0, $t1
                mflo $t2
                mfhi $t3
            "#;

            cpu.run_input(program).unwrap();

            assert_eq!(cpu.get_reg("$t2"), 200); // LO
            assert_eq!(cpu.get_reg("$t3"), 0);   // HI
        }

        #[test]
        fn multu_zero_test() {
            let mut cpu = CPU::new();
            let program = r#"
                li $t0, 0
                li $t1, 12345
                multu $t0, $t1
                mflo $t2
                mfhi $t3
            "#;

            cpu.run_input(program).unwrap();

            assert_eq!(cpu.get_reg("$t2"), 0); // LO
            assert_eq!(cpu.get_reg("$t3"), 0); // HI
        }

        #[test]
        fn multu_max_unsigned_test() {
            let mut cpu = CPU::new();
            let program = r#"
                li $t0, 4294967295
                li $t1, 2
                multu $t0, $t1
                mflo $t2
                mfhi $t3
            "#;

            cpu.run_input(program).unwrap();

            // 4294967295 * 2 = 8589934590 → 0x1FFFFFFFE
            // LO = lower 32 bits, HI = upper 32 bits
            assert_eq!(cpu.get_reg("$t2"), 4294967294); // LO
            assert_eq!(cpu.get_reg("$t3"), 1);          // HI
        }

        #[test]
        fn divu_basic_test() {
            let mut cpu = CPU::new();
            let program = r#"
                li $t0, 20
                li $t1, 3
                divu $t0, $t1
                mflo $t2
                mfhi $t3
            "#;

            cpu.run_input(program).unwrap();

            assert_eq!(cpu.get_reg("$t2"), 6);  // quotient
            assert_eq!(cpu.get_reg("$t3"), 2);  // remainder
        }

        #[test]
        fn divu_divide_by_one_test() {
            let mut cpu = CPU::new();
            let program = r#"
                li $t0, 12345
                li $t1, 1
                divu $t0, $t1
                mflo $t2
                mfhi $t3
            "#;

            cpu.run_input(program).unwrap();

            assert_eq!(cpu.get_reg("$t2"), 12345); // quotient
            assert_eq!(cpu.get_reg("$t3"), 0);     // remainder
        }

        #[test]
        fn divu_divide_by_zero_no_change_test() {
            let mut cpu = CPU::new();
            let program = r#"
                li $t0, 100
                li $t1, 0
                divu $t0, $t1
                mflo $t2
                mfhi $t3
            "#;

            // This test assumes your CPU handles divide-by-zero gracefully
            // For example, leaves LO/HI unchanged or zeroed
            cpu.run_input(program).unwrap();

            assert_eq!(cpu.get_reg("$t2"), 0); // LO unchanged / set to 0
            assert_eq!(cpu.get_reg("$t3"), 0); // HI unchanged / set to 0
        }

        #[test]
        fn divu_max_unsigned_test() {
            let mut cpu = CPU::new();
            let program = r#"
                li $t0, 4294967295
                li $t1, 2
                divu $t0, $t1
                mflo $t2
                mfhi $t3
            "#;

            cpu.run_input(program).unwrap();

            // 4294967295 / 2 = 2147483647 remainder 1
            assert_eq!(cpu.get_reg("$t2"), 2147483647); // quotient
            assert_eq!(cpu.get_reg("$t3"), 1);          // remainder
        }
    }


}