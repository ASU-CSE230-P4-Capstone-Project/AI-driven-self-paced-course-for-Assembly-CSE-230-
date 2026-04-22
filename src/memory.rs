use std::collections::HashMap;
use crate::mmio::{MmioBus, LedDevice, IoDevice}; 

// Constants
pub const DOUBLE_SIZE: usize = 8;          
pub const FLOAT_SIZE: usize = 4;           
pub const WORD_SIZE: usize  = 4;           
pub const HALF_SIZE: usize = 2;            
pub const PAGE_SIZE: usize  = 512;         
pub const PAGE_POWER: u32   = 9;           
pub const PAGE_MASK: u32    = (PAGE_SIZE as u32) - 1;

// Memory Configurations
// MMIO Start Address (LED is at 0xFFFF0000)
pub const MMIO_START: u32 = 0xFFFF_0000;

pub const DEFAULT_STACK_BASE_ADDRESS: u32 = 0x7FFF_FFFF;
pub const DEFAULT_STACK_POINTER: u32 = 0x7FFF_FFFC;
pub const DEFAULT_TEXT_BASE_ADDRESS: u32 = 0x0040_0000;
pub const DEFAULT_STATIC_DATA_BASE_ADDRESS: u32 = 0x1000_0000;
pub const DEFAULT_HEAP_BASE_ADDRESS: u32 = 0x1000_8000;

#[inline]
fn page_index(addr: u32) -> u32 { addr >> PAGE_POWER }

#[inline]
fn page_offset(addr: u32) -> usize { (addr & PAGE_MASK) as usize }

pub struct Memory {
    pub pages: HashMap<u32, Box<[i8; PAGE_SIZE]>>,
    pub snapshot: Option<HashMap<u32, Box<[i8; PAGE_SIZE]>>>, // Holds "frozen" input state
    pub isolation_active: bool,                             // Toggle for autograder mode
    pub mmio: MmioBus, 
}

impl Memory {
    pub fn new() -> Self {        
        let mut pages = HashMap::new();

        // standard pages
        pages.insert((DEFAULT_STACK_BASE_ADDRESS - PAGE_SIZE as u32) >> PAGE_POWER, Box::new([0; PAGE_SIZE]));
        pages.insert(DEFAULT_HEAP_BASE_ADDRESS >> PAGE_POWER, Box::new([0; PAGE_SIZE]));
        pages.insert(DEFAULT_STATIC_DATA_BASE_ADDRESS >> PAGE_POWER, Box::new([0; PAGE_SIZE]));
        pages.insert(DEFAULT_TEXT_BASE_ADDRESS >> PAGE_POWER, Box::new([0; PAGE_SIZE]));

        // MMIO bus
        let mut bus = MmioBus::new();
        
        // Address: 0xFFFF0000, Size: 8 bytes (two registers)
        bus.register(0xFFFF_0000, 8, Box::new(LedDevice::new()));
        
        Memory {
            pages,
            snapshot: None,         // Initialize as None
            isolation_active: false, // Default to standard hardware mode
            mmio: bus,
        }
    }

    pub fn set_word(&mut self, address: u32, value: i32) {
        if address >= MMIO_START {
            self.mmio.store(address, value as u32);
            return; 
        }
        let bytes = value.to_le_bytes();        
        for i in 0..WORD_SIZE {                 
            self.set_byte(address + i as u32, bytes[i] as i8);
        }
    }

    pub fn load_word(&mut self, address: u32) -> i32 {
        if address >= MMIO_START { return self.mmio.load(address) as i32; }
        let mut bytes = [0u8; WORD_SIZE];           
        for i in 0..WORD_SIZE {                         
            bytes[i] = self.load_byte(address + i as u32) as u8;
        }
        i32::from_le_bytes(bytes)             
    }

    pub fn set_byte(&mut self, address: u32, value: i8) {
        if address >= MMIO_START {
             let aligned = address & !3;
             let shift = (address & 3) * 8;
             let current = self.mmio.load(aligned);
             let mask = !(0xFF << shift);
             let new_val = (current & mask) | ((value as u32 & 0xFF) << shift);

             self.mmio.store(aligned, new_val);
             return;
        }

        let page = page_index(address);       
        let offset = page_offset(address);  

        if !self.pages.contains_key(&page) {                   
            self.pages.insert(page, Box::new([0; PAGE_SIZE]));
        }

        let page_data = self.pages.get_mut(&page).unwrap();     
        page_data[offset] = value;
    }

    pub fn load_byte(&mut self, address: u32) -> i8 {
        if address >= MMIO_START {
            let aligned = address & !3;
            let word = self.mmio.load(aligned);
            let shift = (address & 3) * 8;
            return ((word >> shift) & 0xFF) as i8;
        }

        let page = page_index(address);        
        let offset = page_offset(address);   

        // If isolation is active and a snapshot exists, read from the "original" data
        if self.isolation_active {
            if let Some(snap) = &self.snapshot {
                if let Some(page_data) = snap.get(&page) {
                    return page_data[offset];
                }
            }
        }

        if let Some(page_data) = self.pages.get(&page) {    
            page_data[offset]
        } else {
            0
        }
    }

    pub fn set_halfword(&mut self, address: u32, value: i16) {
        if address >= MMIO_START {
             // we just map it to word for now to prevent crashing.
             self.mmio.store(address & !3, value as u32);
             return;
        }

        let page = page_index(address);
        let offset = page_offset(address);

        if !self.pages.contains_key(&page) {                   
            self.pages.insert(page, Box::new([0; PAGE_SIZE]));
        }

        let page_data = self.pages.get_mut(&page).unwrap();     

        let bytes = value.to_le_bytes();        
        for i in 0..HALF_SIZE {                 
            page_data[offset + i] = bytes[i] as i8;
        }
    }

    pub fn load_halfword(&mut self, address: u32) -> i16 {
        if address >= MMIO_START {
            return self.mmio.load(address & !3) as i16;
        }

        let page = page_index(address);        
        let offset = page_offset(address);   

        if let Some(page_data) = self.pages.get(&page) {    
            let mut bytes = [0 as u8; HALF_SIZE];           
            for i in 0..HALF_SIZE {                         
                bytes[i] = page_data[offset + i] as u8;
            }
            i16::from_le_bytes(bytes)             
        } else {
            0
        }
    }

    pub fn set_double(&mut self, address: u32, value: f64) {
        let page = page_index(address);       
        let offset = page_offset(address);   

        if !self.pages.contains_key(&page) {                   
            self.pages.insert(page, Box::new([0; PAGE_SIZE]));
        }

        let page_data = self.pages.get_mut(&page).unwrap();     
        let bytes = value.to_le_bytes();
        for i in 0..DOUBLE_SIZE {
            page_data[offset + i] = bytes[i] as i8;
        }
    }

    pub fn load_double(&mut self, address: u32) -> f64 {
        let page = page_index(address);
        let offset = page_offset(address);

        if let Some(page_data) = self.pages.get(&page) {    
            let mut bytes = [0 as u8; DOUBLE_SIZE];
            for i in 0..DOUBLE_SIZE {
                bytes[i] = page_data[offset + i] as u8;
            }
            f64::from_le_bytes(bytes)
        } else {
            0.0
        }
    }

    pub fn set_float(&mut self, address: u32, value: f32) {
        let page = page_index(address);       
        let offset = page_offset(address);   

        if !self.pages.contains_key(&page) {                   
            self.pages.insert(page, Box::new([0; PAGE_SIZE]));
        }

        let page_data = self.pages.get_mut(&page).unwrap();     
        let bytes = value.to_le_bytes();
        for i in 0..FLOAT_SIZE {
            page_data[offset + i] = bytes[i] as i8;
        }
    }

    pub fn load_float(&mut self, address: u32) -> f32 {
        let page = page_index(address);       
        let offset = page_offset(address);   

        if let Some(page_data) = self.pages.get(&page) {    
            let mut bytes = [0 as u8; FLOAT_SIZE];
            for i in 0..FLOAT_SIZE {
                bytes[i] = page_data[offset + i] as u8;
            }
            f32::from_le_bytes(bytes)
        } else {
            0.0
        }
    }

    pub fn set_string(&mut self, address: u32, value: &str) {
        if address >= MMIO_START { return; } 

        let string_bytes = value.as_bytes();
        for (i, &byte) in string_bytes.iter().enumerate() {
            self.set_byte(address + i as u32, byte as i8);
        }
    }

    pub fn get_memory_slice(&mut self, start_address: u32, length: usize) -> Vec<u8> {
        let mut result = Vec::with_capacity(length);

        for i in 0..length {
            // use load byte for MMIO
            let val = self.load_byte(start_address + i as u32);
            result.push(val as u8);
        }
        
        result
    }

    pub fn freeze_inputs(&mut self) {
        self.snapshot = Some(self.pages.clone());
        self.isolation_active = true;
    }

    pub fn thaw_inputs(&mut self) {
        self.isolation_active = false;
        self.snapshot = None;
    }
}