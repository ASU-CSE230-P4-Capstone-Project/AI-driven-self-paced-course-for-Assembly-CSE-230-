use crate::program::EmuError;

/// enum used to represent each MIPS instruction
#[derive(Debug, Clone)]
pub enum CoreInstruction {
    /// R[rd] = R[rs] + R[rt] 
    Add { rd: String, rs: String, rt: String },

    /// R[rd] = R[rs] + R[rt]
    Addu { rd: String, rs: String, rt: String },

    /// R[rt] = R[rs] + SignExtImm 
    Addi { rt: String, rs: String, imm: i32 },


    /// R[rt] = R[rs] + SignExtImm
    Addiu { rt: String, rs: String, imm: u32 },

    /// R[rd] = R[rs] - R[rt]
    Sub { rd: String, rs: String, rt: String },

    /// R[rd] = R[rs] - R[rt] 
    Subu { rd: String, rs: String, rt: String },

    /// R[rt] = imm << 16
    Lui { rt: String, imm: u32 },

    /// R[rt] = M[R[rs]+SignExtImm]
    Sb { rt: String, rs: String, imm: i32 },

    /// R[rt] = M[R[rs]+SignExtImm]
    Lb { rt: String, rs: String, imm: i32 },

    /// R[rt] = M[R[rs]+SignExtImm]
    Sh { rt: String, rs: String, imm: i32 },

    /// R[rt] = M[R[rs]+SignExtImm]
    Lh { rt: String, rs: String, imm: i32 },

    /// M[R[rs]+SignExtImm] = R[rt] 
    Sw { rs: String, imm: i32, rt: String },

    /// R[rt] = M[R[rs]+SignExtImm]
    Lw { rt: String, rs: String, imm: i32 },

    /// PC=JumpAddr
    J { label: String },

    /// R[$ra]=PC+8;PC=JumpAddr
    Jal { label: String },

    /// PC=R[rs] 
    Jr { rs: String },

    /// R[rd] = R[rs] | R[rt]
    Or { rd: String, rs: String, rt: String },

    /// R[rt] = R[rs] | ZeroExtImm
    Ori { rt: String, rs: String, imm: u32 },

    /// R[rd] = R[rs] & R[rt] 
    And { rd: String, rs: String, rt: String },

    /// R[rt] = R[rs] & ZeroExtImm
    Andi { rt: String, rs: String, imm: u32 },

    /// if(R[rs] == R[rt]) PC=JumpAddr
    Beq { rs: String, rt: String, label: String },

    /// if(R[rs] != R[rt]) PC=JumpAddr
    Bne { rs: String, rt: String, label: String },
    
    // R[rd] = (R[rs] < R[rt]) ? 1 : 0
    Slt { rd: String, rs: String, rt: String },
    
    ///
    Slti { rt: String, rs: String, imm: i32 },

    ///
    Sltiu { rt: String, rs:String,imm:u32 },

    ///
    Sltu{ rd:String, rs:String, rt:String},

    /// {Hi,Lo} = R[rs] * R[rt] 
    Mult { rs: String, rt: String },

    /// R[rd] = Hi
    Mfhi { rd: String },

    /// R[rd] = Lo 
    Mflo { rd: String } ,

    /// R[rd] = R[rs] ^ R[rt] 
    Xor { rd: String, rs: String, rt: String },

    /// R[rt] = R[rs] ^ ZeroExtImm
    Xori { rt: String, rs: String, imm: u32 },

    /// {Lo, Hi} = R[rs] / R[rt]
    Div {rs:String, rt:String },

    /// R[rd] = ~(R[rs] | R[rt])
    Nor {rd: String, rs: String, rt: String},

    Sll {rd: String, rt: String, sa: u32},

    Srl {rd: String, rt: String, sa: u32},

    Sra { rd: String, rt: String, imm: i32 }, // added on sponsor request 

    Multu { rs: String, rt: String },
    
    Divu { rs: String, rt: String }
}

#[derive(Debug, Clone)]
pub enum PseudoInstruction {
    Lw { rt: String, label: String },
    La { rt: String, label: String },
    Move { rd:String, rs:String },

    /// R[rd] = immediate
    Li { rd: String, imm: u32 },

    // if(R[rs] < R[rt]) PC=label
    Blt { rs: String, rt: String, label: String },
    // if(R[rs] > R[rt]) PC=label
    Bgt { rs: String, rt: String, label: String },
    // if(R[rs] <= R[rt]) PC=label
    Ble { rs: String, rt: String, label: String },
    // if(R[rs] >= R[rt]) PC=label
    Bge { rs: String, rt: String, label: String },
}

#[derive(Debug, Clone)]
pub enum Instruction {
    Core(CoreInstruction),
    Pseudo(PseudoInstruction),
}