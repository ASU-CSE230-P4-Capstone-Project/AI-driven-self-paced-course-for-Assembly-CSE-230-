use crate::lexer::{Lexer, Token, TokenType};
// use crate::lexer::alert;
use crate::instruction::Instruction;
use crate::instruction::CoreInstruction;
use crate::instruction::PseudoInstruction;
use crate::program::EmuError;
use crate::memory::Memory;
use std::collections::{HashMap, VecDeque};
    
#[derive(Debug, Clone)]
pub struct Label {
    pub name: String,
}

#[derive(Debug, Clone)]
pub enum ProgramStatement {
    Instruction(Instruction),
    Label(Label),
}

#[derive(Clone)]
enum Section {
    Text,
    Data,
}

#[derive(Clone)]
pub struct Parser {
    lexer: Lexer,
    syntax_error: bool,
    pub syntax_error_message: String,
    section: Section,
    data_section_pointer: u32,

    program_statements: Vec<ProgramStatement>,
    pub symbol_table: HashMap<String, u32>,
    line_numbers: Vec<usize>,
    current_line: usize,
    instruction_index: u32,
    tokens: VecDeque<Token>,
}

impl Parser {
    pub fn new() -> Self {
        Parser { 
            lexer: Lexer::new(), 
            syntax_error: false, 
            syntax_error_message: String::from("No Errors"),
            program_statements: Vec::new(),
            symbol_table: HashMap::new(),
            line_numbers: Vec::new(),
            current_line: 0,
            instruction_index: 0,
            tokens: VecDeque::new(),
            section: Section::Text,
            data_section_pointer: crate::memory::DEFAULT_STATIC_DATA_BASE_ADDRESS,
        }
    }

    pub fn parse_program(&mut self, code: &str, memory: &mut Memory) -> Result<(Vec<ProgramStatement>, HashMap<String, u32>, Vec<usize>), EmuError> {
        self.reset();
        
        let all_tokens = self.lexer.tokenize(code);
        
        // group tokens by line then sort them
        let mut tokens_by_line = HashMap::new();
        for token in all_tokens {
            tokens_by_line.entry(token.line_number).or_insert(Vec::new()).push(token);
        }

        let mut sorted_lines: Vec<_> = tokens_by_line.keys().cloned().collect();
        sorted_lines.sort();

        // parse each line using Paul's code
        for line_num in sorted_lines {
            self.tokens = tokens_by_line.get(&line_num).unwrap().clone().into(); 
            self.current_line = line_num;
            
            self.parse_statement(memory)?; 
        }

        // validate labels
        for program_statement in &self.program_statements {
            
             match program_statement {
                ProgramStatement::Instruction(Instruction::Core(CoreInstruction::J { label })) |
                ProgramStatement::Instruction(Instruction::Core(CoreInstruction::Jal { label })) |
                ProgramStatement::Instruction(Instruction::Core(CoreInstruction::Beq { label, .. })) |
                ProgramStatement::Instruction(Instruction::Core(CoreInstruction::Bne { label, .. })) |
                ProgramStatement::Instruction(Instruction::Pseudo(PseudoInstruction::La { label, .. })) |
                ProgramStatement::Instruction(Instruction::Pseudo(PseudoInstruction::Blt { label, .. })) |
                ProgramStatement::Instruction(Instruction::Pseudo(PseudoInstruction::Bgt { label, .. })) |
                ProgramStatement::Instruction(Instruction::Pseudo(PseudoInstruction::Ble { label, .. })) |
                ProgramStatement::Instruction(Instruction::Pseudo(PseudoInstruction::Bge { label, .. })) => {
                    if !self.symbol_table.contains_key(label) {
                        return Err(EmuError::UndefinedLabel(label.clone()));
                    }
                }
                _ => {}
            }
        }

        Ok((self.program_statements.clone(), self.symbol_table.clone(), self.line_numbers.clone()))
    }

    pub fn parse_statement(&mut self, memory: &mut Memory) -> Result<(), EmuError> {
        let x = self.peek(0);
        if let Some(token) = x {
            if token.token_type == TokenType::Directive && token.lexeme == ".data" {
                self.section = Section::Data;
            } else if token.token_type == TokenType::Directive && token.lexeme == ".text" {
                self.section = Section::Text;
            } else {
                match self.section {
                    Section::Data => self.parse_data(memory)?,
                    Section::Text => self.parse_text()?,
                }
            }
        }
        Ok(())
    }

    pub fn parse_data(&mut self, memory: &mut Memory) -> Result<(), EmuError> {
        // alert("Parsing data section");

        let x = self.peek(0);
        if let Some(token) = x {
            let label = self.expect(TokenType::Identifier)?;
            self.expect(TokenType::Colon)?;
            let directive = self.expect(TokenType::Directive)?;
            // alert(format!("Label: {}, Directive: {}", label.lexeme, directive.lexeme).as_str());

            if self.symbol_table.contains_key(&label.lexeme) {
                return Err(self.error(format!("Line {}: Duplicate label {}", label.line_number, label.lexeme)));
            }

            let mut address = self.data_section_pointer;

            // Handle address alignment for data types that require it.
            match directive.lexeme.as_str() {
                ".half" => {
                    let alignment = 2;
                    address = (self.data_section_pointer + alignment - 1) & !(alignment - 1);
                },
                ".word" => {
                    let alignment = 4;
                    address = (self.data_section_pointer + alignment - 1) & !(alignment - 1);
                },
                ".double" => {
                    let alignment = 8;
                    address = (self.data_section_pointer + alignment - 1) & !(alignment - 1);
                },
                ".float" => {
                    let alignment = 4;
                    address = (self.data_section_pointer + alignment - 1) & !(alignment - 1);
                },
                _ => {}
            }
            
            self.symbol_table.insert(label.lexeme.clone(), address);
            self.data_section_pointer = address;

            self.parse_data_operands(&label, &directive.lexeme, memory)?;
        }
        // Implementation for parsing data section goes here
        Ok(())
    }
    pub fn parse_data_operands(&mut self, label_token: &Token, directive: &str, memory: &mut Memory) -> Result<(), EmuError> {
        // Implementation for parsing data operands goes here
        let x = self.peek(0);
        if let Some(token) = x {
            match directive {
                ".word" | ".half" | ".byte" => {
                    let value = self.expect(TokenType::Integer)?;
                    // alert(format!("Parsed {} value: {}", directive, value.lexeme).as_str());

                    let label = label_token.lexeme.clone();
                    let line_num = label_token.line_number;
                    let address = self.data_section_pointer; 

                    match directive {
                        ".byte" => {
                            if value.lexeme.parse::<i8>().is_err() {
                                return Err(self.error(format!("At line {}: Value {} is out of range for .byte", line_num, value.lexeme)));
                            }
                            memory.set_byte(address, value.lexeme.parse::<i8>().unwrap());

                            self.data_section_pointer += 1;
                        },
                        ".half" => {
                            if value.lexeme.parse::<i16>().is_err() {
                                return Err(self.error(format!("At line {}: Value {} is out of range for .half", line_num, value.lexeme)));
                            }
                            memory.set_halfword(address, value.lexeme.parse::<i16>().unwrap());

                            self.data_section_pointer += 2;
                        },
                        ".word" => {
                            if value.lexeme.parse::<i32>().is_err() {
                                return Err(self.error(format!("At line {}: Value {} is out of range for .word", line_num, value.lexeme)));
                            }
                            memory.set_word(address, value.lexeme.parse::<i32>().unwrap());

                            self.data_section_pointer += 4;
                        },
                        _ => {}
                    }

                    let x = self.peek(0);
                    if let Some(token) = x {
                        if token.token_type == TokenType::Delimiter {
                            self.expect(TokenType::Delimiter)?;
                            self.parse_data_operands(label_token, directive, memory)?;
                        } else {
                            return Err(self.error(format!("At line {}: Unexpected token {:?}", self.current_line, token.lexeme)));
                        }
                    }
                },
                ".double" | ".float" => {
                    let value = self.peek(0);

                    if let Some(token) = value {
                        if token.token_type == TokenType::RealNumber || token.token_type == TokenType::Integer {
                            // alert(format!("Parsed {} value: {}", directive, token.lexeme).as_str());
                            
                            let address = self.data_section_pointer;
                            let line_num = token.line_number;
                            let lexeme = token.lexeme.clone();

                            if token.token_type == TokenType::RealNumber {
                                self.expect(TokenType::RealNumber)?;
                            } else if token.token_type == TokenType::Integer {
                                self.expect(TokenType::Integer)?;
                            }

                            match directive {
                                ".double" => {
                                    if lexeme.parse::<f64>().is_err() {
                                        return Err(self.error(format!("At line {}: Value {} is out of range for .double", line_num, lexeme)));
                                    }
                                    memory.set_double(address, lexeme.parse::<f64>().unwrap());

                                    self.data_section_pointer += 8;
                                },
                                ".float" => {
                                    if lexeme.parse::<f32>().is_err() {
                                        return Err(self.error(format!("At line {}: Value {} is out of range for .float", line_num, lexeme)));
                                    }
                                    memory.set_float(address, lexeme.parse::<f32>().unwrap());

                                    self.data_section_pointer += 4;
                                },
                                _ => {}
                            }

                            let x = self.peek(0);
                            if let Some(token) = x {
                                if token.token_type == TokenType::Delimiter {
                                    self.expect(TokenType::Delimiter)?;
                                    self.parse_data_operands(label_token, directive, memory)?;
                                } else {
                                    return Err(self.error(format!("At line {}: Unexpected token {:?}", self.current_line, token.lexeme)));
                                }
                            }
                        } else {
                            return Err(self.error(format!("At line {}: Expected real number or integer for {}, found {:?}", self.current_line, directive, token.lexeme)));
                        }
                    }
                },
                ".space" => {
                    let value = self.expect(TokenType::Integer)?;
                    // alert(format!("Parsed .space value: {}", value.lexeme).as_str());

                    let line_num = label_token.line_number;

                    if value.lexeme.parse::<u32>().is_err() {
                        return Err(self.error(format!("At line {}: Value {} is out of range for .space", line_num, value.lexeme)));
                    }

                    self.data_section_pointer += value.lexeme.parse::<u32>().unwrap();
                },
                ".ascii" => {
                    let value = self.expect(TokenType::QuotedString)?;
                    // alert(format!("Parsed .ascii value: {}", value.lexeme).as_str());

                    let address = self.data_section_pointer;

                    memory.set_string(address, value.lexeme.as_str());

                    self.data_section_pointer += value.lexeme.len() as u32;
                },
                ".asciiz" => {
                    let value = self.expect(TokenType::QuotedString)?;
                    // alert(format!("Parsed .asciiz value: {}", value.lexeme).as_str());

                    let mut lexeme = value.lexeme.clone();
                    let address = self.data_section_pointer;

                    lexeme.push('\0');
                    memory.set_string(address, lexeme.as_str());

                    self.data_section_pointer += lexeme.len() as u32;
                },
                _ => {
                    // Handle other directives or return an error
                }
            }
        }
        Ok(())
    }

    pub fn parse_text(&mut self) -> Result<(), EmuError> {
        // 1. Process labels (can be multiple on one line like 'L1: L2: addi...')
        while let Some(token) = self.peek(0) {
            if token.token_type == TokenType::Identifier 
                && self.peek(1).map_or(false, |t| t.token_type == TokenType::Colon) {
                
                let label_token = self.expect(TokenType::Identifier)?;
                self.expect(TokenType::Colon)?;
                
                let label_name = label_token.lexeme.clone();
                let line_num = label_token.line_number;

                // Immediate duplicate check
                if self.symbol_table.insert(label_name.to_string(), 0).is_some() {
                    return Err(self.error(format!("Line {}: Duplicate label {}", line_num, label_name)));
                } else {
                    self.program_statements.push(ProgramStatement::Label(Label { name: label_name }));
                }
            } else {
                break;
            }
        }

        // 2. Process potential instruction following the labels
        if let Some(token) = self.peek(0) {
            if token.token_type == TokenType::Mnemonic {
                let insn = self.parse_instruction()?;
                self.program_statements.push(ProgramStatement::Instruction(insn));
                self.line_numbers.push(self.current_line);
                self.instruction_index += 1;
            } else if token.token_type != TokenType::Comment {
                // If it's not an instruction, a label, or a comment, it's an error
                return Err(self.error(format!("At line {}: Unexpected token {:?}", self.current_line, token.lexeme)));
            }
        }
        Ok(())
    }

    pub fn parse_instruction(&mut self) -> Result<Instruction, EmuError> {
        let x = self.peek(0);

        if let Some(token_ref) = x {
            let lexeme = token_ref.lexeme.clone();

            // match the instruction by lexeme to the right parsing fn
            match lexeme.as_str() {
                "add" | "sub" | "or" | "addu" | "subu" | "and" | "slt" | "sltu" | "mult" | "multu" | "mflo" | "mfhi" | "xor" | "div" | "divu" | "nor" | "sll" | "srl" | "sra" => self.parse_r_type(&lexeme),
                "j" | "jal" | "jr" => self.parse_j_type(&lexeme),
                "addi" | "addiu" | "lb" | "sb" | "lh" | "sh" | "lw" | "sw" | "ori" | "beq" | "bne" | "andi"| "slti" | "sltiu"| "xori" | "lui" => self.parse_i_type(&lexeme),
                "move" | "la" | "li" | "blt" | "bgt" | "ble" | "bge" => self.parse_pseudo_instruction(&lexeme),
                _ => Err(self.error(format!("Line {}: Unknown instruction {}", self.current_line, lexeme)))
            }
        } else {
             Err(self.error(format!("Line {}: Expected instruction", self.current_line)))
        }
    }

    fn is_valid_register(&self, name: &str) -> bool {
        matches!(name,
            "$zero" | "$at" |
            "$v0" | "$v1" |
            "$a0" | "$a1" | "$a2" | "$a3" |
            "$t0" | "$t1" | "$t2" | "$t3" | "$t4" | "$t5" | "$t6" | "$t7" |
            "$s0" | "$s1" | "$s2" | "$s3" | "$s4" | "$s5" | "$s6" | "$s7" |
            "$t8" | "$t9" |
            "$k0" | "$k1" |
            "$gp" | "$sp" | "$fp" | "$ra"
        )
    }

    fn parse_register(&mut self) -> Result<String, EmuError> {
        let token = self.expect(TokenType::RegisterName)?;
        
        if self.is_valid_register(&token.lexeme) {
            Ok(token.lexeme)
        } else {
            let err_msg = format!("Line {}: Invalid Register {}", self.current_line, token.lexeme);
            
            self.syntax_error = true;
            self.syntax_error_message = err_msg.clone();
            Err(EmuError::InvalidReg(err_msg))
        }
    }

    fn parse_immediate<T>(&mut self) -> Result<T, EmuError>
    where
        T: TryFrom<i64>,
    {
        let token = self.expect(TokenType::Integer)?;
        let val = Self::parse_int_literal(&token.lexeme)
            .ok_or_else(|| self.error(format!("Line {}: Invalid immediate value {}", self.current_line, token.lexeme)))?;
        T::try_from(val)
            .map_err(|_| self.error(format!("Line {}: Immediate value out of range {}", self.current_line, token.lexeme)))
    }

    fn parse_int_literal(s: &str) -> Option<i64> {
        let s = s.trim();
        if s.starts_with("0x") || s.starts_with("0X") {
            i64::from_str_radix(&s[2..], 16).ok()
        } else if s.starts_with("-0x") || s.starts_with("-0X") {
            i64::from_str_radix(&s[3..], 16).ok().map(|v| -v)
        } else {
            s.parse::<i64>().ok()
        }
    }
    
    fn parse_label(&mut self) -> Result<String, EmuError> {
        let token = self.next_token().ok_or_else(|| self.error("Expected label".to_string()))?;
        if token.token_type == TokenType::Mnemonic || token.token_type == TokenType::Identifier || token.token_type == TokenType::Directive {
            Ok(token.lexeme)
        } else {
            Err(self.error(format!("Line {}: Expected label", self.current_line)))
        }
    }

    pub fn parse_r_type(&mut self, mnemonic: &str) -> Result<Instruction, EmuError> {
        self.expect(TokenType::Mnemonic)?;

        match mnemonic {
            "add" | "sub" | "or" | "addu" | "subu" | "and" | "slt" | "sltu" | "xor" | "nor" => {
                let rd = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let rs = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let rt = self.parse_register()?;

                match mnemonic {
                    "add" => Ok(Instruction::Core(CoreInstruction::Add { rd, rs, rt })),
                    "sub" => Ok(Instruction::Core(CoreInstruction::Sub { rd, rs, rt })),
                    "or"  => Ok(Instruction::Core(CoreInstruction::Or { rd, rs, rt })),
                    "addu" => Ok(Instruction::Core(CoreInstruction::Addu { rd, rs, rt })),
                    "subu" => Ok(Instruction::Core(CoreInstruction::Subu { rd, rs, rt })),
                    "and"  => Ok(Instruction::Core(CoreInstruction::And { rd, rs, rt })),
                    "slt"  => Ok(Instruction::Core(CoreInstruction::Slt { rd, rs, rt })),
                    "sltu" => Ok(Instruction::Core(CoreInstruction::Sltu { rd, rs, rt })), 
                    "xor"  => Ok(Instruction::Core(CoreInstruction::Xor {rd, rs, rt})),
                    "nor" => Ok(Instruction::Core(CoreInstruction::Nor {rd, rs, rt})),
                    _ => unreachable!()
                }
            },

            "mult" | "multu" => {
                let rs = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let rt = self.parse_register()?;

                match mnemonic {
                    "mult" => Ok(Instruction::Core(CoreInstruction::Mult { rs, rt })),
                    "multu" => Ok(Instruction::Core(CoreInstruction::Multu { rs, rt })),
                    _ => unreachable!()
                }
            },

            "mflo" | "mfhi" => {
                let rd = self.parse_register()?;
                match mnemonic {
                    "mflo" => Ok(Instruction::Core(CoreInstruction::Mflo { rd })),
                    "mfhi" => Ok(Instruction::Core(CoreInstruction::Mfhi { rd })),
                    _ => unreachable!()
                }
            },

            "div" | "divu" => {
                let rs = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let rt = self.parse_register()?;

                match mnemonic {
                    "div" => Ok(Instruction::Core(CoreInstruction::Div {rs, rt})),
                    "divu" => Ok(Instruction::Core(CoreInstruction::Divu {rs, rt})),
                    _ => unreachable!()
                }
            },

            "srl" | "sll" | "sra" => {
                let rd = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;

                let rt = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;

                let sa_token = self.expect(TokenType::Integer)?;

                let sa: u32 = Self::parse_int_literal(&sa_token.lexeme)
                    .ok_or_else(|| self.error(format!("Line {}: invalid shift amount {}", self.current_line, sa_token.lexeme)))? as u32;

                match mnemonic {
                    "sll" => Ok(Instruction::Core(CoreInstruction::Sll { rd, rt, sa })),
                    "srl" => Ok(Instruction::Core(CoreInstruction::Srl { rd, rt, sa })),
                    "sra" => Ok(Instruction::Core(CoreInstruction::Sra { rd, rt, imm: sa as i32 })),
                    _ => unreachable!()
                }
            },

            _ => Err(self.error(format!("Line {}: Unknown R-Type instruction {}", self.current_line, mnemonic)))
        }
    }

    pub fn parse_i_type(&mut self, mnemonic: &str) -> Result<Instruction, EmuError> {
        self.expect(TokenType::Mnemonic)?;

        if mnemonic == "lui" {
            let rt = self.parse_register()?;
            self.expect(TokenType::Delimiter)?;

            let imm = self.parse_immediate::<u32>()?; 
            return Ok(Instruction::Core(CoreInstruction::Lui { rt, imm }));
        }

        if mnemonic == "lw" || mnemonic == "sw" || mnemonic == "lb" || mnemonic == "lh" || mnemonic == "sb" || mnemonic == "sh" {
            let rt = self.parse_register()?;
            self.expect(TokenType::Delimiter)?;

            let x = self.peek(0);

            if let Some(token) = x {
                if token.token_type == TokenType::Integer {
                    let imm = self.parse_immediate::<i32>()?;
                    self.expect(TokenType::LeftParen)?;
                    let rs = self.parse_register()?;
                    self.expect(TokenType::RightParen)?;
                    match mnemonic {
                        "lw" => Ok(Instruction::Core(CoreInstruction::Lw { rt, rs, imm })),
                        "sw" => Ok(Instruction::Core(CoreInstruction::Sw { rt, rs, imm })),
                        "lb" => Ok(Instruction::Core(CoreInstruction::Lb { rt, rs, imm })),
                        "sb" => Ok(Instruction::Core(CoreInstruction::Sb { rt, rs, imm })),
                        "lh" => Ok(Instruction::Core(CoreInstruction::Lh { rt, rs, imm })),
                        "sh" => Ok(Instruction::Core(CoreInstruction::Sh { rt, rs, imm })),
                        _ => Err(self.error(format!("At line {}: Unexpected token {:?}", self.current_line, mnemonic))),
                    }
                } else if token.token_type == TokenType::Identifier {
                    let label = self.expect(TokenType::Identifier)?;
                    if mnemonic == "lw" {
                        Ok(Instruction::Pseudo(PseudoInstruction::Lw { rt, label: label.lexeme }))
                    } else {
                        Err(self.error(format!("At line {}: Unsupported pseudo instruction", self.current_line)))
                    }
                } else {
                    return Err(self.error(format!("At line {}: Unexpected token {:?}", self.current_line, token.lexeme)));
                }
            } else {
                return Err(self.error(format!("At line {}: Unexpected end of input", self.current_line)));
            }
        } else if mnemonic == "beq" || mnemonic == "bne" {
            let rs = self.parse_register()?;
            self.expect(TokenType::Delimiter)?;
            let rt = self.parse_register()?;
            self.expect(TokenType::Delimiter)?;
            let label = self.parse_label()?;

            if mnemonic == "beq" {
                Ok(Instruction::Core(CoreInstruction::Beq { rs, rt, label }))
            } else {
                Ok(Instruction::Core(CoreInstruction::Bne { rs, rt, label }))
            }
        } else {
            let rt = self.parse_register()?;
            self.expect(TokenType::Delimiter)?;
            let rs = self.parse_register()?;
            self.expect(TokenType::Delimiter)?;
            
            match mnemonic {
                "addi" => Ok(Instruction::Core(CoreInstruction::Addi { rt, rs, imm: self.parse_immediate::<i32>()? })),
                "addiu" => Ok(Instruction::Core(CoreInstruction::Addiu { rt, rs, imm: self.parse_immediate::<u32>()? })),
                "ori" => Ok(Instruction::Core(CoreInstruction::Ori { rt, rs, imm: self.parse_immediate::<u32>()? })),
                "andi" => Ok(Instruction::Core(CoreInstruction::Andi { rt, rs, imm: self.parse_immediate::<u32>()? })),
                "slti" => Ok(Instruction::Core(CoreInstruction::Slti {rt, rs, imm: self.parse_immediate::<i32>()? })),
                "sltiu" => Ok(Instruction::Core(CoreInstruction::Sltiu {rt, rs, imm: self.parse_immediate::<u32>()? })),
                "xori" => Ok(Instruction::Core(CoreInstruction::Xori {rt, rs, imm: self.parse_immediate::<u32>()? })),
                 _ => Err(self.error(format!("Line {}: Unhandled I-Type", self.current_line)))
            }
        }
    }

    // pub fn parse_li(&mut self) -> Result<Instruction, EmuError> {
    //     self.expect(TokenType::Mnemonic)?;
    //     let rd = self.parse_register()?;
    //     self.expect(TokenType::Delimiter)?;

    //     let imm_token = self.expect(TokenType::Integer)?;

    //     // parse as i32 first (for negative number support like -1 as signed)
    //     if let Ok(imm) = imm_token.lexeme.parse::<i32>() {
    //         Ok(Instruction::Core(CoreInstruction::Li { rd, imm: imm as u32 }))
    //     } else if let Ok(imm) = imm_token.lexeme.parse::<u32>() {
    //         Ok(Instruction::Core(CoreInstruction::Li { rd, imm: imm }))
    //     } else {
    //         Err(self.error(format!("Line {}: Invalid immediate value {}", self.current_line, imm_token.lexeme)))
    //     }
    // }

    pub fn parse_j_type(&mut self, mnemonic: &str) -> Result<Instruction, EmuError> {
        self.expect(TokenType::Mnemonic)?;

        match mnemonic {
            "j" => Ok(Instruction::Core(CoreInstruction::J { label: self.parse_label()? })),
            "jal" => Ok(Instruction::Core(CoreInstruction::Jal { label: self.parse_label()? })),
            "jr" => Ok(Instruction::Core(CoreInstruction::Jr { rs: self.parse_register()? })),
            _ => Err(self.error(format!("Line {}: Unknown J-Type", self.current_line)))
        }
    }

    pub fn parse_pseudo_instruction(&mut self, mnemonic: &str) -> Result<Instruction, EmuError> {
        self.expect(TokenType::Mnemonic)?;

        match mnemonic {
            "move" => {
                let rd = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let rs = self.parse_register()?;

                Ok(Instruction::Pseudo(PseudoInstruction::Move { rd, rs }))
            },
            "la" => {
                let rt = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let label = self.parse_label()?;
                Ok(Instruction::Pseudo(PseudoInstruction::La { rt, label }))
            },
            "li" => {
                let rd = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let imm_token = self.expect(TokenType::Integer)?;

                let imm: i64 = Self::parse_int_literal(&imm_token.lexeme)
                    .ok_or_else(|| self.error(format!("Line {}: Invalid immediate value {}", self.current_line, imm_token.lexeme)))?;

                Ok(Instruction::Pseudo(PseudoInstruction::Li { rd, imm: imm as u32 }))
            },
            "blt" => {
                let rs = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let rt = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let label = self.parse_label()?;
                Ok(Instruction::Pseudo(PseudoInstruction::Blt { rs, rt, label }))
            },
            "bgt" => {
                let rs = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let rt = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let label = self.parse_label()?;
                Ok(Instruction::Pseudo(PseudoInstruction::Bgt { rs, rt, label }))
            },
            "ble" => {
                let rs = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let rt = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let label = self.parse_label()?;
                Ok(Instruction::Pseudo(PseudoInstruction::Ble { rs, rt, label }))
            },
            "bge" => {
                let rs = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let rt = self.parse_register()?;
                self.expect(TokenType::Delimiter)?;
                let label = self.parse_label()?;
                Ok(Instruction::Pseudo(PseudoInstruction::Bge { rs, rt, label }))
            },
            _ => Err(self.error(format!("Line {}: Unknown pseudo-instruction", self.current_line)))
        }
    }

    fn error(&mut self, msg: String) -> EmuError {
        self.syntax_error = true;
        self.syntax_error_message = msg.clone();

        EmuError::ParsingError(msg)
    }

    fn next_token(&mut self) -> Option<Token> {
        loop {
            match self.tokens.pop_front() {
                Some(token) if token.token_type == TokenType::Comment => continue,
                other => return other,
            }
        }
    }

    fn peek(&self, offset: usize) -> Option<&Token> {
        self.tokens.iter()
        .skip(offset)
        .find(|t| t.token_type != TokenType::Comment)
    }

    pub fn expect(&mut self, expected: TokenType) -> Result<Token, EmuError> {
        if self.syntax_error {
            return Err(self.error("Parser already in error state".to_string()));
        }

        let token_option = self.next_token();
        if let Some(token) = token_option {
            if token.token_type != expected {
                let err = self.error(format!("At line {}: Expected token {}, found {:?}", token.line_number, expected, token.lexeme));
                Err(err)
            } else {
                Ok(token)
            }
        } else {
            let err = self.error(format!("At line {}: Expected token {}, found end of line", self.current_line, expected));
            Err(err)
        }
    }

    pub fn reset(&mut self) {
        self.syntax_error = false;
        self.syntax_error_message = String::from("No Errors");

        self.program_statements.clear();
        self.symbol_table.clear();
        self.line_numbers.clear();
        self.tokens.clear();
        self.current_line = 0;
        self.instruction_index = 0;
    }
}