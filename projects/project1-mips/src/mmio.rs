use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// general interface for any virtual device
pub trait IoDevice: Send + Sync {
    fn read(&mut self, offset: u32) -> u32;
    
    fn write(&mut self, offset: u32, value: u32);
    
    fn name(&self) -> &'static str;

    /// provides a representation of state for the frontend
    fn get_state(&self) -> DeviceState;
}

/// serialized state for the device peripherals supported
// this data is returned as a Map to the JS code
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", content = "data")] 
pub enum DeviceState {
    Led { value: u32, color: u32 },
}

/// represents a generic LED
pub struct LedDevice {
    pub value: u32,
    pub color: u32,
}

impl LedDevice {
    pub fn new() -> Self { Self { value: 0, color: 0x00FF00 } }
}

impl IoDevice for LedDevice {
    fn read(&mut self, offset: u32) -> u32 {
        match offset {
            0 => self.value,
            4 => self.color,
            _ => 0,
        }
    }

    fn write(&mut self, offset: u32, value: u32) {
        match offset {
            0 => self.value = value,
            4 => self.color = value & 0x00FFFFFF,
            _ => {}
        }
    }

    fn name(&self) -> &'static str { "LED" }

    fn get_state(&self) -> DeviceState {
        DeviceState::Led { value: self.value, color: self.color }
    }
}

/// represents a MMIO controller that will route memory accesses to the corresponding device
pub struct MmioBus {
    // (Start Address, End Address, Device)
    devices: Vec<(u32, u32, Box<dyn IoDevice>)>,
}

impl MmioBus {
    pub fn new() -> Self {
        MmioBus { devices: Vec::new() }
    }

    /// add a device to the bus at a specific base address
    pub fn register(&mut self, base_addr: u32, size: u32, device: Box<dyn IoDevice>) {
        let end_addr = base_addr + size;
        self.devices.push((base_addr, end_addr, device));
    }

    pub fn load(&mut self, address: u32) -> u32 {
        for (start, end, device) in &mut self.devices {
            if address >= *start && address < *end {

                // calculate offset
                return device.read(address - *start);
            }
        }

        // for invalid reads
        0
    }

    pub fn store(&mut self, address: u32, value: u32) {
        for (start, end, device) in &mut self.devices {
            if address >= *start && address < *end {
                device.write(address - *start, value);
                return;
            }
        }
    }

    /// generate mapping for the UI
    pub fn snapshot(&self) -> HashMap<u32, DeviceState> {
        let mut map = HashMap::new();
        for (start, _, device) in &self.devices {
            map.insert(*start, device.get_state());
        }
        map
    }
}