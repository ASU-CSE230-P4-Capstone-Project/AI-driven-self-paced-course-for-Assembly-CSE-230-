use std::io::{self, Read};
use std::collections::HashMap;
use mips_emu_wasm::cpu::CPU;
use serde::{Serialize, Deserialize};

/// receive input from the Python autograder from stdin
/// serialized as JSON 
#[derive(Deserialize)]
struct GraderInput {
    source_code: String,

    #[serde(default)]
    initial_registers: HashMap<String, i64>,

    #[serde(default)]
    initial_memory: HashMap<String, i64>,

    /// memory addresses to read back after execution (for memory test cases)
    #[serde(default)]
    check_memory: Vec<u64>,
}

/// output format sent back to the Python autograder via stdout
#[derive(Serialize)]
struct GraderOutput {
    registers: HashMap<String, i64>,
    memory: HashMap<String, i64>,
    error: String,
}

fn main() {
    let mut input_str = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut input_str) {
        print_error(&format!("Failed to read stdin: {}", e));
        return;
    }

    let input: GraderInput = match serde_json::from_str(&input_str) {
        Ok(v) => v,
        Err(e) => {
            print_error(&format!("Invalid JSON input: {}", e));
            return;
        }
    };

    let mut cpu = CPU::new();

    // initial register values from autograder
    for (reg, val) in &input.initial_registers {
        cpu.set_reg(reg, *val as u32);
    }

    // initial memory values from autograder
    for (addr_str, val) in &input.initial_memory {
        let addr: u32 = match addr_str.parse() {
            Ok(a) => a,
            Err(_) => {
                print_error(&format!("Invalid memory address: {}", addr_str));
                return;
            }
        };
        cpu.memory.set_word(addr, *val as i32);
    }

    // run the code from the student received from autograder
    if let Err(e) = cpu.run_input(&input.source_code) {
        // ExecutionLimitExceeded and other fatal errors
        let err_msg = format!("{:?}", e);

        let registers = collect_registers(&cpu);
        let memory = collect_memory(&mut cpu, &input.check_memory);

        let output = GraderOutput {
            registers,
            memory,
            error: err_msg,
        };

        println!("{}", serde_json::to_string(&output).unwrap());
        return;
    }

    // return registers and memory to the autograder
    let registers = collect_registers(&cpu);
    let memory = collect_memory(&mut cpu, &input.check_memory);

    let output = GraderOutput {
        registers,
        memory,
        error: String::new(),
    };

    println!("{}", serde_json::to_string(&output).unwrap());
}

fn collect_registers(cpu: &CPU) -> HashMap<String, i64> {
    let reg_names = [
        "$zero", "$at", "$v0", "$v1",
        "$a0", "$a1", "$a2", "$a3",
        "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
        "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
        "$t8", "$t9", "$k0", "$k1",
        "$gp", "$sp", "$fp", "$ra",
    ];

    let mut regs = HashMap::new();
    for name in &reg_names {
        let unsigned = cpu.get_reg(name);
        // Convert to signed for consistency with test case expectations
        let signed = unsigned as i32 as i64;
        regs.insert(name.to_string(), signed);
    }
    regs
}

fn collect_memory(cpu: &mut CPU, addresses: &[u64]) -> HashMap<String, i64> {
    let mut mem = HashMap::new();
    for &addr in addresses {
        let val = cpu.memory.load_word(addr as u32);
        mem.insert(addr.to_string(), val as i64);
    }
    mem
}

fn print_error(msg: &str) {
    let output = GraderOutput {
        registers: HashMap::new(),
        memory: HashMap::new(),
        error: msg.to_string(),
    };
    println!("{}", serde_json::to_string(&output).unwrap());
}