use serde::{Serialize, Deserialize};
use std::fmt;
use crate::instruction::Instruction;

use std::collections::VecDeque;

use wasm_bindgen::prelude::*;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TokenType {
    /*
    If it starts with a ".", it's a directive like .data or .text
    */
    Directive,
    /*
    A label identifier like "main:" or "loop:"
    or a data identifier like "myVariable: .word 5"
    */
    Identifier,
    /*
    An operator like add, sub, lw, sw, etc.
    */
    Mnemonic,
    /*
    If it starts with a "#", the rest of the line is a comment.
    */
    Comment,
    /*
    ",", "\n"
    */
    Delimiter,
    Colon,
    /*
    a "$t0" register name
    */
    RegisterName,
    /*
    a "$8" register number instead of "$t0"
    */
    RegisterNumber,
    /*
    a quoted string like "Hello, World!"
    */
    QuotedString,
    LeftParen,
    RightParen,
    Integer,
    RealNumber,
    /*
    A unknown token type
    */
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Token {
    pub lexeme: String,
    pub token_type: TokenType,
    pub line_number: usize,
}

#[derive(Clone)]
pub struct Lexer {
    code: String,
    tokens: VecDeque<Token>,
    index: usize,
    line_number: usize,
}

impl Lexer {
    pub fn new() -> Self {
        Lexer {
            code: String::new(),
            tokens: VecDeque::new(),
            index: 0,
            line_number: 1,
        }
    }

    pub fn tokenize(&mut self, code: &str) -> VecDeque<Token> {
        self.code = code.to_string();
        self.line_number = 1;
        self.tokens.clear();

        for line in code.lines() {
            // // green(format!("Tokenizing line: {}", line).as_str());
            let mut i = 0;

            while i < line.len() {  
                let c = line.chars().nth(i).unwrap();
                let mut tokenFound = false;

                // Start of comment
                if c == '#' {   
                    // // green("Found comment, ignoring rest of line");
                    let new_token = Token {
                        lexeme: line[i..].to_string(),
                        token_type: TokenType::Comment,
                        line_number: self.line_number,
                    };
                    self.tokens.push_back(new_token);
                    i = line.len(); // Move index to end of line
                    tokenFound = true;
                    continue;
                }

                // Start of quoted string
                if c == '"' {   
                    let closing_quote_index_option = findClosingQuoteString(i + 1, line);
                    // // green(format!("Closing index option: {:?}", closing_index_option).as_str());
                    if let Some(closing_quote_index) = closing_quote_index_option {
                        let new_token = Token {
                            lexeme: line[i+1..closing_quote_index].to_string(),
                            token_type: TokenType::QuotedString,
                            line_number: self.line_number,
                        };
                        self.tokens.push_back(new_token);
                        i = closing_quote_index; // Move index to character after closing quote
                        tokenFound = true;
                        // // green(format!("next i value: {}", line.chars().nth(i).unwrap()).as_str());
                    } else {
                        // // green("Error: Unterminated string literal");
                    }
                    // // green(format!("i: {} line length: {}", i, line.len()).as_str());
                }

                // , indicates delimiter
                if c == ',' { 
                    let new_token = Token {
                        lexeme: c.to_string(),
                        token_type: TokenType::Delimiter,
                        line_number: self.line_number,
                    };
                    self.tokens.push_back(new_token);
                    tokenFound = true;
                    // // green("Found delimiter token");
                }

                // : indicates Colon
                if c == ':' { 
                    let new_token = Token {
                        lexeme: c.to_string(),
                        token_type: TokenType::Colon,
                        line_number: self.line_number,
                    };
                    self.tokens.push_back(new_token);
                    tokenFound = true;
                    // // green("Found colon token");
                }

                // dot indicates possible directive
                if c == '.' {   
                    let mut directive_end = consumeTilPuncAndWs(i + 1, line);
                    let possible_directive = &line[i..directive_end];
                    if matchDirective(possible_directive) {
                        let new_token = Token {
                            lexeme: possible_directive.to_string(),
                            token_type: TokenType::Directive,
                            line_number: self.line_number,
                        };
                        self.tokens.push_back(new_token);
                        // // green(format!("Found directive token: {}", possible_directive).as_str());
                        tokenFound = true;
                        i = directive_end - 1; // Move index to end of directive
                    } else {
                        // green(format!("Not a directive: {}", possible_directive).as_str());
                    }
                }

                // dollar sign indicates possible register
                if c == '$' {
                    let mut register_end = consumeTilPuncAndWs(i + 1, line);
                    let possible_register = &line[i..register_end];
                    let new_token = Token {
                        lexeme: possible_register.to_string(),
                        token_type: TokenType::RegisterName, // For simplicity, treat all as RegisterName
                        line_number: self.line_number,
                    };
                    self.tokens.push_back(new_token);
                    // // green(format!("Found register token: {}", possible_register).as_str());
                    tokenFound = true;
                    i = register_end - 1; // Move index to end of register
                }

                if c == '(' {
                    let new_token = Token {
                        lexeme: c.to_string(),
                        token_type: TokenType::LeftParen,
                        line_number: self.line_number,
                    };
                    self.tokens.push_back(new_token);
                    tokenFound = true;
                    // // green("Found left parenthesis token");
                }

                if c == ')' {
                    let new_token = Token {
                        lexeme: c.to_string(),
                        token_type: TokenType::RightParen,
                        line_number: self.line_number,
                    };
                    self.tokens.push_back(new_token);
                    tokenFound = true;
                    // // green("Found right parenthesis token");
                }
                
                // handle negative integers also 
                if c == '-' {
                    if let Some(next_char) = line.chars().nth(i + 1) {
                        if next_char.is_ascii_digit() {
                            let (token_type, number_end) = classify_number(i + 1, line);
                            let possible_number = &line[i..number_end];

                            if token_type == Some(TokenType::Integer) {
                                let new_token = Token {
                                    lexeme: possible_number.to_string(),
                                    token_type: token_type.unwrap(),
                                    line_number: self.line_number,
                                };
                                self.tokens.push_back(new_token);
                                // // green(format!("Found integer token: {}", possible_number).as_str());
                                tokenFound = true;
                                i = number_end - 1; // Move index to end of number
                            } else if token_type == Some(TokenType::RealNumber) {
                                let new_token = Token {
                                    lexeme: possible_number.to_string(),
                                    token_type: token_type.unwrap(),
                                    line_number: self.line_number,
                                };
                                self.tokens.push_back(new_token);
                                // // green(format!("Found real number token: {}", possible_number).as_str());
                                tokenFound = true;
                                i = number_end - 1; // Move index to end of number
                            }
                        }
                    }
                }

                // digit indicates possible integer or real number
                if !tokenFound && c.is_ascii_digit() {
                    let (token_type, number_end) = classify_number(i, line);
                    let possible_number = &line[i..number_end];

                    if token_type == Some(TokenType::Integer) {
                        let new_token = Token {
                            lexeme: possible_number.to_string(),
                            token_type: token_type.unwrap(),
                            line_number: self.line_number,
                        };
                        self.tokens.push_back(new_token);
                        // // green(format!("Found integer token: {}", possible_number).as_str());
                        tokenFound = true;
                        i = number_end - 1; // Move index to end of number
                    } else if token_type == Some(TokenType::RealNumber) {
                        let new_token = Token {
                            lexeme: possible_number.to_string(),
                            token_type: token_type.unwrap(),
                            line_number: self.line_number,
                        };
                        self.tokens.push_back(new_token);
                        // // green(format!("Found real number token: {}", possible_number).as_str());
                        tokenFound = true;
                        i = number_end - 1; // Move index to end of number
                    }
                }

                // alphabetic indicates possible Mnemonic or Identifier (label or data)
                if c.is_ascii_alphabetic() || c == '_' {
                    let mut end = consumeTilPuncAndWs(i + 1, line);

                    
                    let lexeme = &line[i..end];
                    
                    let mut match_mnemonic = match_mnemonic(&line[i..end]);
                    let mut is_identifier = isIdentifier(line, end);

                    if match_mnemonic {
                        // alert(format!("Found mnemonic: {}", lexeme).as_str());
                        let new_token = Token {
                            lexeme: lexeme.to_string(),
                            token_type: TokenType::Mnemonic,
                            line_number: self.line_number,
                        };
                        self.tokens.push_back(new_token);
                        tokenFound = true;
                        i = end - 1; // Move index to end of the token
                    } else if is_identifier {
                        // alert(format!("Found identifier: {}", lexeme).as_str());
                        let new_token = Token {
                            lexeme: lexeme.to_string(),
                            token_type: TokenType::Identifier,
                            line_number: self.line_number,
                        };
                        self.tokens.push_back(new_token);
                        tokenFound = true;
                        i = end - 1; // Move index to end of the token
                    }

                    // alert(format!("Found lexeme: {}", lexeme).as_str());
                }

                // If no token matched, and not whitespace, it's an unknown token
                if !tokenFound && !c.is_whitespace() {
                    let mut unknown_end = consumeTilPuncAndWs(i + 1, line);
                    let possible_unknown = &line[i..unknown_end];
                    let new_token = Token {
                        lexeme: possible_unknown.to_string(),
                        token_type: TokenType::Unknown,
                        line_number: self.line_number,
                    };
                    self.tokens.push_back(new_token);
                    i = unknown_end - 1; // Move index to end of unknown token
                    // // green(format!("Found unknown token: {}", possible_unknown).as_str());
                }
                // // green(format!("Checking character... {}", c).as_str());
                i += 1;
            }

            // // green(format!("{}", line[line.len() - 1..].to_string()).as_str());

            for token in &self.tokens {
                // // green(format!("Token: {} Token Type: {:?}", token.value, token.token_type).as_str());
            }

            self.line_number += 1;
        }

        return self.tokens.clone();
    }

    pub fn matchTokenType(&self) {

    }

    pub fn getToken(&mut self) -> Option<Token> {
        self.tokens.pop_front()
    }

    pub fn peek(&self) -> Option<&Token> {
        self.tokens.front()
    }
}

fn findClosingQuoteString(i: usize, s: &str) -> Option<usize> {
    let mut index = i;
    let mut prev_char = '\0';
    for c in s.chars().skip(i) {
        if c == '"' && prev_char != '\\' {
            // // green("Found closing quote string");
            return Some(index);
        }
        prev_char = c;

        index += 1;
        // // green(format!("Index: {} Char: {}", index, c).as_str());
    }
    return None;
}

fn matchDirective(s: &str) -> bool {
    let directives = vec![
        ".data",
        ".text",
        ".globl",
        ".ascii",
        ".asciiz",
        ".double",
        ".float",
        ".word",
        ".byte",
        ".half",
        ".space",
    ];

    for directive in directives {
        if s == directive {
            return true;
        }
    }
    return false;
}

fn match_mnemonic(s: &str) -> bool {
    match s {
            "add" | "sub" | "or" | "addu" | "subu" | "and" |"j" | "jal" | "jr" |"li" |
            "addi" | "addiu" | "lb" | "sb" | "lh" | "sh" | "lw" | "sw" | "ori" | "beq" | "bne" | "andi" | "la" | "lui" | 
            "move" | "mult" | "multu" | "mflo" | "mfhi" | "xor" | "xori" | "div" | "divu" | "nor" | "sll" | "srl" | "sra" |
            "slt" | "slti" | "sltiu" |
            "blt" | "bgt" | "ble" | "bge" => true,
            _ => false,
        }
}

fn isIdentifier(s: &str, end: usize) -> bool {
    if let Some(next_char) = s.chars().nth(end) {
        // alert(format!("Next char after identifier: {}", next_char).as_str());
        if next_char == ':' || next_char.is_whitespace() || next_char == '#' {
            return true;
        }
    } else {
        // reached end of line
        return true;
    }
    return false;
}

fn consumeTilPuncAndWs(i: usize, s: &str) -> usize {
    let mut index = i;
    for c in s.chars().skip(i) {
        // skip underscores since those are used by labels
        if c.is_whitespace() || (c.is_ascii_punctuation() && c != '_' && c != '$') { 
            return index;
        }
        index += 1;
    }
    return index;
}

// fn consumeInteger(i: usize, s: &str) -> usize {
//     let mut index = i;
//     for c in s.chars().skip(i) {
//         if !c.is_ascii_digit() {
//             return index;
//         }
//         index += 1;
//     }
//     return index;
// }

fn classify_number(i: usize, s: &str) -> (Option<TokenType>, usize) {
    let mut index = i;
    let mut is_integer = true;
    let mut decimal_seen = false;
    let chars: Vec<char> = s.chars().collect();

    if index + 1 < chars.len() && chars[index] == '0' && (chars[index + 1] == 'x' || chars[index + 1] == 'X') {
        index += 2;
        while index < chars.len() && (chars[index].is_ascii_hexdigit()) {
            index += 1;
        }
        return (Some(TokenType::Integer), index);
    }

    for c in s.chars().skip(i) {
        if c.is_ascii_digit() {
            index += 1;
        } else if c == '.' && !decimal_seen {
            is_integer = false;
            decimal_seen = true;
            index += 1;
        } else {
            break;
        }
    }

    if is_integer && index > i {
        (Some(TokenType::Integer), index)
    } else if !is_integer && index > i {
        (Some(TokenType::RealNumber), index)
    } else {
        (None, index)
    }
}

impl fmt::Display for TokenType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            TokenType::Directive => "Directive",
            TokenType::Identifier => "Identifier",
            TokenType::Mnemonic => "Mnemonic",
            TokenType::Comment => "Comment",
            TokenType::Delimiter => "Delimiter",
            TokenType::Colon => "Colon",
            TokenType::RegisterName => "RegisterName",
            TokenType::RegisterNumber => "RegisterNumber",
            TokenType::QuotedString => "QuotedString",
            TokenType::LeftParen => "LeftParen",
            TokenType::RightParen => "RightParen",
            TokenType::Integer => "Integer",
            TokenType::RealNumber => "RealNumber",
            TokenType::Unknown => "Unknown",
        };
        write!(f, "{}", s)
    }
}

#[wasm_bindgen]
extern {
    pub fn alert(s: &str);
}