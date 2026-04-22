// The WASM module built with: wasm-pack build --target nodejs --out-dir api/pkg-node
// This imports the generated JS wrapper which loads the .wasm binary.
const { WasmCPU } = require('./pkg-node/mips_emu_wasm.js');

const REG_NAMES = [
  '$zero', '$at', '$v0', '$v1',
  '$a0',   '$a1', '$a2', '$a3',
  '$t0',   '$t1', '$t2', '$t3', '$t4', '$t5', '$t6', '$t7',
  '$s0',   '$s1', '$s2', '$s3', '$s4', '$s5', '$s6', '$s7',
  '$t8',   '$t9', '$k0', '$k1',
  '$gp',   '$sp', '$fp', '$ra',
];

function collectRegisters(cpu) {
  const regs = {};
  // After execution, we read registers from the WASM CPU's snapshot.
  return regs;
}

/**
 * Run student MIPS code with initial state and return register/memory results.
 */
function runEmulator(sourceCode, initialRegisters, initialMemory, checkMemory, useIsolation) {
  const cpu = new WasmCPU();

  const loadResult = cpu.load_source(sourceCode);
  if (loadResult && loadResult.error && loadResult.error.length > 0) {
    return { registers: {}, memory: {}, error: loadResult.error };
  }

  // apply initial register values
  for (const [reg, val] of Object.entries(initialRegisters || {})) {
    try {
      cpu.set_register(reg, Number(val) >>> 0);
    } catch (e) {
      return { registers: {}, memory: {}, error: `Bad register ${reg}: ${e.message}` };
    }
  }

  // apply initial memory values
  for (const [addrStr, val] of Object.entries(initialMemory || {})) {
    try {
      cpu.set_memory_word(parseInt(addrStr, 10), Number(val));
    } catch (e) {
      return { registers: {}, memory: {}, error: `Bad memory addr ${addrStr}: ${e.message}` };
    }
  }

  // execute
  let execResult;
  let runError = '';

  try {
    if (useIsolation) {
      cpu.set_isolation(true); // Call the WASM method we added to lib.rs
    } 

    try {
      execResult = cpu.run();
      
      if (execResult && execResult.error && execResult.error !== 'Termination') {
        runError = execResult.error;
      }
    } finally {
      cpu.set_isolation(false); // Always cleanup
    }
  } catch (e) {
    runError = e.message || String(e);
  }

  // Collect registers from the snapshot
  const finalRegisters = {};
  const snapRegs = execResult?.snapshot?.registers;
  if (snapRegs) {
    const entries = (snapRegs instanceof Map)
      ? Array.from(snapRegs.entries())
      : Object.entries(snapRegs);

    for (const [name, val] of entries) {

      const unsigned = Number(val) >>> 0;
      const signed = unsigned > 0x7FFFFFFF ? unsigned - 0x100000000 : unsigned;
      finalRegisters[name] = signed;
    }
  }

  const finalMemory = {};
  for (const addr of (checkMemory || [])) {
    try {
      const bytes = cpu.get_memory(Number(addr), 4);
      if (bytes && bytes.length >= 4) {
        const unsigned = (
            bytes[0] | 
            (bytes[1] << 8) | 
            (bytes[2] << 16) | 
            (bytes[3] << 24)
        ) >>> 0;
        
        const signed = unsigned > 0x7FFFFFFF ? unsigned - 0x100000000 : unsigned;
        finalMemory[String(addr)] = signed;
      }
    } catch (_) {
      finalMemory[String(addr)] = null;
    }
  }

  return {
    registers: finalRegisters,
    memory:    finalMemory,
    error:     runError,
  };
}


module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { source_code, initial_registers, initial_memory, check_memory, use_isolation } = req.body;

    if (!source_code && source_code !== '') {
      return res.status(400).json({ error: 'source_code is required' });
    }

    const result = runEmulator(
      source_code,
      initial_registers || {},
      initial_memory || {},
      check_memory || [],
      use_isolation || false,
    );

    return res.status(200).json(result);

  } catch (err) {
    console.error('Emulator error:', err);
    return res.status(500).json({
      registers: {},
      memory: {},
      error: `Server error: ${err.message}`,
    });
  }
};
