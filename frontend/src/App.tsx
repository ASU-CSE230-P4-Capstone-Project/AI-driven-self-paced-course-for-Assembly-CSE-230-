import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { assemble } from './LabPage'
import DebugBar from './DebugBar'
import userDocumentationPdf from './assets/userdocumentation.pdf'
import './App.css'

// Types for the generated WASM bindings
type WasmModule = typeof import('./wasm/pkg/web_x86_core')
type EmulatorApi = import('./wasm/pkg/web_x86_core').Emulator

const SAMPLE_CODE = `; Demo: MOV, PUSH, POP, SUB, and ADD
MOV EAX, 0x100
MOV EBX, 0x50
ADD EAX, EBX
SUB EAX, 0x30
PUSH EAX
POP ECX
; After Run, check:
; - EAX = 0x00000120 (0x100 + 0x50 - 0x30)
; - ECX = 0x00000120 (popped from stack)
; - EBX = 0x00000050 (unchanged)`

const REGISTER_KEYS = ['eip', 'eax', 'ebx', 'ecx', 'edx', 'ebp', 'esp', 'esi', 'edi'] as const
type RegisterKey = (typeof REGISTER_KEYS)[number]
type RegistersState = Record<RegisterKey, string>
type MemoryCell = {
  address: number
  value: number | null
}
type StackViewRow = {
  address: string
  value: string
  isTop: boolean
  unreadable: boolean
}

const DEFAULT_MEMORY_BYTES = 48
const MEMORY_BYTE_OPTIONS = [16, 32, 48, 64, 96, 128] as const
const STACK_VIEW_ROWS = 8

function createMemoryViewPlaceholder(startAddress: number, byteCount: number): MemoryCell[] {
  const start = startAddress >>> 0
  return Array.from({ length: byteCount }, (_, i) => ({
    address: (start + i) >>> 0,
    value: null,
  }))
}

const DEFAULT_REGISTERS: RegistersState = {
  eip: '0x00001000',
  eax: '0x00000000',
  ebx: '0x00000000',
  ecx: '0x00000000',
  edx: '0x00000000',
  ebp: '0x00f00000',
  esp: '0x00f00000',
  esi: '0x00000000',
  edi: '0x00000000',
}

export default function App() {
//zoom feature
  const EDITOR_BASE_FONT_SIZE = 13
  const MIN_EDITOR_ZOOM = 100
  const MAX_EDITOR_ZOOM = 300
  const EDITOR_ZOOM_STEP = 10
  
  const [code, setCode] = useState(SAMPLE_CODE)
  const [consoleOutput, setConsoleOutput] = useState('Hello, World!\n')
  const [steps, setSteps] = useState(0)
  const [wasmReady, setWasmReady] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const wasmEmuRef = useRef<EmulatorApi | null>(null)
  const wasmModRef = useRef<WasmModule | null>(null)
  const LOAD_ADDR = 0x00001000
  type Breakpoint = { address: number; enabled: boolean; line?: number }
  const [breakpoints, setBreakpoints] = useState<Map<number, Breakpoint>>(new Map())
  const [lineToAddr, setLineToAddr] = useState<Map<number, number>>(new Map())
  const [hasRun, setHasRun] = useState(false)
  const [programFinished, setProgramFinished] = useState(false)
  const [currentLine, setCurrentLine] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const editorScrollRef = useRef<HTMLTextAreaElement | null>(null)
  const gutterScrollRef = useRef<HTMLDivElement | null>(null)
  const lines = code.split('\n')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()
  const [editorZoom, setEditorZoom] = useState(100)


  const editorFontSize = Math.max(8, Math.round((EDITOR_BASE_FONT_SIZE * editorZoom) / 100))
  const editorLineHeight = Math.max(12, Math.round(editorFontSize * 1.45))
  const editorPaddingY = Math.max(6, Math.round((12 * editorZoom) / 100))
  const editorPaddingX = Math.max(8, Math.round((12 * editorZoom) / 100))
  const editorGutterWidth = Math.max(48, Math.round((60 * editorZoom) / 100))
  const editorGutterFontSize = Math.max(10, Math.round((12 * editorZoom) / 100))
  const editorGutterTopPadding = Math.max(6, Math.round((12 * editorZoom) / 100))
  const editorLineNoWidth = Math.max(18, Math.round(editorGutterFontSize * 2))
  const zoomInEditor = () => {
    setEditorZoom((z) => Math.min(MAX_EDITOR_ZOOM, z + EDITOR_ZOOM_STEP))
  }
  const zoomOutEditor = () => {
    setEditorZoom((z) => Math.max(MIN_EDITOR_ZOOM, z - EDITOR_ZOOM_STEP))
  }
  // placeholder registers
  const [registers, setRegisters] = useState<RegistersState>({ ...DEFAULT_REGISTERS })
  const lastValidRegistersRef = useRef<RegistersState>({ ...DEFAULT_REGISTERS })

  // placeholder flags
  const [flags, setFlags] = useState({
    zf: 0,
    sf: 0,
    of: 0,
    cf: 0,
    df: 0,
    pf: 0,
  })

  const [memoryStartAddress, setMemoryStartAddress] = useState(LOAD_ADDR)
  const [memoryStartInput, setMemoryStartInput] = useState('0x00001000')
  const [memoryByteCount, setMemoryByteCount] = useState(DEFAULT_MEMORY_BYTES)
  const [memoryByteCountInput, setMemoryByteCountInput] = useState(DEFAULT_MEMORY_BYTES)
  const [memoryView, setMemoryView] = useState<MemoryCell[]>(
    () => createMemoryViewPlaceholder(LOAD_ADDR, DEFAULT_MEMORY_BYTES),
  )
  const [stackView, setStackView] = useState<StackViewRow[]>([])

  const setRegistersCommitted = (next: RegistersState) => {
    const committed = { ...next }
    lastValidRegistersRef.current = committed
    setRegisters(committed)
  }

  const parseRegisterValue = (raw: string): number | null => {
    const t = raw.trim()
    if (!t) return null
    if (/^0x[0-9a-f]+$/i.test(t)) {
      return parseInt(t, 16) >>> 0
    }
    if (/^[+-]?\d+$/.test(t)) {
      return parseInt(t, 10) >>> 0
    }
    if (/^[0-9a-f]+$/i.test(t) && /[a-f]/i.test(t)) {
      return parseInt(t, 16) >>> 0
    }
    return null
  }

  const formatRegisterValue = (n: number | bigint) => {
    const val = typeof n === 'bigint' ? Number(n) : n
    return `0x${(val >>> 0).toString(16).padStart(8, '0')}`
  }

  const applyMemoryRange = () => {
    const parsed = parseRegisterValue(memoryStartInput)
    if (parsed == null) {
      setConsoleOutput((s) => s + `Invalid memory start address: ${memoryStartInput}\n`)
      setMemoryStartInput(formatRegisterValue(memoryStartAddress))
      return
    }

    const nextStart = parsed >>> 0
    const nextCount = memoryByteCountInput
    setMemoryStartAddress(nextStart)
    setMemoryStartInput(formatRegisterValue(nextStart))
    setMemoryByteCount(nextCount)

    const emu = wasmEmuRef.current
    if (emu) {
      refreshRegistersFromWasm(emu, { memoryStart: nextStart, memoryBytes: nextCount })
    } else {
      setMemoryView(createMemoryViewPlaceholder(nextStart, nextCount))
    }
  }

  const onMemoryByteCountChange = (nextCount: number) => {
    setMemoryByteCountInput(nextCount)
  }

  const setEmuRegister = (emu: EmulatorApi, reg: RegisterKey, value: number): void => {
    switch (reg) {
      case 'eip':
        emu.set_eip(value)
        break
      case 'eax':
        emu.set_eax(value)
        break
      case 'ebx':
        emu.set_ebx(value)
        break
      case 'ecx':
        emu.set_ecx(value)
        break
      case 'edx':
        emu.set_edx(value)
        break
      case 'ebp':
        emu.set_ebp(value)
        break
      case 'esp':
        emu.set_esp(value)
        break
      case 'esi':
        emu.set_esi(value)
        break
      case 'edi':
        emu.set_edi(value)
        break
    }
  }

  const applyRegistersToEmu = (emu: EmulatorApi, regs: RegistersState) => {
    for (const reg of REGISTER_KEYS) {
      const parsed = parseRegisterValue(regs[reg])
      if (parsed == null) continue
      setEmuRegister(emu, reg, parsed)
    }
  }

  const commitRegister = (reg: RegisterKey) => {
    const parsed = parseRegisterValue(registers[reg])
    if (parsed == null) {
      setConsoleOutput((s) => s + `Invalid ${reg.toUpperCase()} value: ${registers[reg]}\n`)
      setRegisters({ ...lastValidRegistersRef.current })
      return
    }
    const formatted = formatRegisterValue(parsed)
    const next = { ...lastValidRegistersRef.current, [reg]: formatted }
    setRegistersCommitted(next)

    const emu = wasmEmuRef.current
    if (emu) {
      setEmuRegister(emu, reg, parsed)
      if (reg === 'esp') {
        refreshRegistersFromWasm(emu)
      }
    }
  }

  const onRegisterInputChange = (reg: RegisterKey, value: string) => {
    setRegisters((prev) => ({ ...prev, [reg]: value }))
  }
  // Check auth and role on mount
  useEffect(() => {
    const role = localStorage.getItem('userRole')
    const user = localStorage.getItem('username')

    if (!role) {
      navigate('/login')
      return
    }

    setUserRole(role)
    setUsername(user || 'User')
  }, [navigate])

  // 1. cd core   /   wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg --dev --out-name web_x86_cor
  // 2. cd frontend   /   npm install   /   npm run dev
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const wasm: WasmModule = await import('./wasm/pkg/web_x86_core')
        // Initialize the WASM module (default export is the init function)
        await wasm.default()
        // Only preload module; instantiate Emulator later on Run (frontend controls lifecycle)
        wasmModRef.current = wasm

        if (mounted) {
          setConsoleOutput((s) => s + 'WASM: module ready\n')
          setWasmReady(true)
        }
      } catch (err) {
        console.error('WASM load error', err)
        setConsoleOutput((s) => s + `WASM load error: ${String(err)}\n`)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const { errors, lineToAddr } = assemble(code)
    if (errors.length === 0) {
      setLineToAddr(lineToAddr)
    } else {
      setLineToAddr(new Map())
    }
  }, [code])

  // Minimal assembler: supports
  // - MOV <REG>, <IMM32>   (encodes B8..BF + imm32)
  // - PUSH <REG>           (encodes 50..57)
  // - POP <REG>            (encodes 58..5F)
  // - ADD <REG>, <REG|IMM32> (01/81 /0)
  // - SUB <REG>, <REG|IMM32> (29/81 /5)
  // - AND <REG>, <REG|IMM32> (21/81 /4)
  // - OR  <REG>, <REG|IMM32> (09/81 /1)
  // - CMP <REG>, <REG|IMM32> (3B/81 /7)
  // - SHL/SAL/SHR/SAR <REG>, <IMM8> (C1 /4,/5,/7)
  // - MUL <REG>            (F7 /4)
  // - IDIV <REG>           (F7 /7)
  // - IMUL <REG>, <REG>    (0F AF /r)
  // - CDQ                  (99)
  // - JMP <REL|LABEL>      (EB rel8 if -128..127 else E9 rel32)
  // - Jcc <REL8|LABEL>     (JE/JNE/JL/JGE/JLE/JG + aliases, rel8)
  // - CALL <REL32|LABEL>   (E8 rel32)
  // - RET                  (C3)
  // Lines can contain comments starting with ';'

  function onRun() {
    if (!wasmReady || !wasmModRef.current) {
      setConsoleOutput((s) => s + 'WASM not ready\n')
      return
    }

    // Instantiate a fresh Emulator when user decides to Run
    const { Emulator } = wasmModRef.current
    const emu = new Emulator()
    wasmEmuRef.current = emu

    const { bytes, errors, lineToAddr, addrToLine } = assemble(code)
    if (errors.length) {
      setConsoleOutput((s) => s + errors.map((e) => `ASM error: ${e}`).join('\n') + '\n')
      return
    }

    setLineToAddr(lineToAddr)

    try {
      // load assembled bytes at LOAD_ADDR
      emu.load_program(bytes, LOAD_ADDR)
      applyRegistersToEmu(emu, registers)
      setConsoleOutput((s) => s + `Assembled ${bytes.length} bytes. Running...\n`)

      // Run up to a small instruction budget to avoid infinite loops
      const MAX_STEPS = 256
      const programEnd = LOAD_ADDR + bytes.length
      let hitBreakpoint = false

      for (let i = 0; i < MAX_STEPS; i++) {
        const before = Number(emu.get_eip())

        const bp = breakpoints.get(before)
        if (bp?.enabled) {
          const hitLine = bp.line ?? addrToLine.get(before) ?? null
          setCurrentLine(hitLine)
          setPaused(true)
          setConsoleOutput(
            (s) => s + `Paused at breakpoint on line ${hitLine ?? '?'} (EIP=0x${before.toString(16).padStart(8, '0')})\n`
          )
          hitBreakpoint = true
          break
        }

        // Stop once execution leaves the loaded program window
        if (before < LOAD_ADDR || before >= programEnd) break

        emu.step()
        const after = Number(emu.get_eip())

        // Stop if instruction execution made no forward progress
        if (after === before) break
      }

      const total = Number(emu.get_steps?.() ?? 0)
      setSteps(total)
      setHasRun(true)

      if (!hitBreakpoint) {
        setPaused(false)
        const finalLine = addrToLine.get(Number(emu.get_eip())) ?? null
        setCurrentLine(finalLine)
        setProgramFinished(true)
        setConsoleOutput((s) => s + `Run complete. Steps=${total}\n`)
      }
      refreshRegistersFromWasm(emu)
    } catch (e) {
      setConsoleOutput((s) => s + `WASM runtime error: ${String(e)}\n`)
    }
  }

  function onStep() {
    if (!wasmReady || !wasmModRef.current) {
      setConsoleOutput((s) => s + 'WASM not ready\n')
      return
    }

    const { bytes, errors, lineToAddr, addrToLine } = assemble(code)
    if (errors.length) {
      setConsoleOutput((s) => s + errors.map((e) => `ASM error: ${e}`).join('\n') + '\n')
      return
    }

    const programEnd = LOAD_ADDR + bytes.length

    setLineToAddr(lineToAddr)

    // Create emulator if it doesn't exist yet
    if (!wasmEmuRef.current) {
      const { Emulator } = wasmModRef.current
      const emu = new Emulator()
      wasmEmuRef.current = emu
      applyRegistersToEmu(emu, registers)

      try {
        emu.load_program(bytes, LOAD_ADDR)
        setConsoleOutput((s) => s + `Assembled ${bytes.length} bytes. Stepping...\n`)
      } catch (e) {
        setConsoleOutput((s) => s + `WASM load error: ${String(e)}\n`)
        return
      }
    }

    const emu = wasmEmuRef.current
    try {
      const eip = Number(emu.get_eip())

      if (eip < LOAD_ADDR || eip >= programEnd) {
        setPaused(false)
        setProgramFinished(true)
        setConsoleOutput((s) => s + 'Program finished. Reset to run again.\n')
        return
      }

      const bp = breakpoints.get(eip)
      if (bp?.enabled && !paused) {
        const hitLine = bp.line ?? addrToLine.get(eip) ?? null
        setCurrentLine(hitLine)
        setPaused(true)
        setConsoleOutput(
          (s) => s + `Paused at breakpoint on line ${hitLine ?? '?'} (EIP=0x${eip.toString(16).padStart(8, '0')})\n`
        )
        return
      }

      const beforeEip = Number(emu.get_eip())
      const beforeSteps = Number(emu.get_steps())
      const stepCount = Number(emu.step())
      const afterEip = Number(emu.get_eip())

      if (afterEip < LOAD_ADDR || afterEip >= programEnd) {
        setSteps(stepCount)
        setCurrentLine(null)
        setPaused(false)
        setProgramFinished(true)
        setConsoleOutput((s) => s + `Step ${stepCount}\nProgram finished. Reset to run again.\n`)
        refreshRegistersFromWasm(emu)
        return
      }
      if (afterEip === beforeEip && stepCount === beforeSteps) {
        setPaused(false)
        setProgramFinished(true)
        setConsoleOutput((s) => s + 'Program finished execution. Reset to run again.\n')
        return
      }

      setSteps(stepCount)

      const nextLine = addrToLine.get(afterEip) ?? null
      setCurrentLine(nextLine)
      setPaused(false)
      setConsoleOutput((s) => s + `Step ${stepCount}\n`)
      refreshRegistersFromWasm(emu)
    } catch (e) {
      setConsoleOutput((s) => s + `WASM step error: ${String(e)}\n`)
    }
  }

  function onContinue() {
    if (!wasmReady || !wasmModRef.current) {
      setConsoleOutput((s) => s + 'WASM not ready\n')
      return
    }
    if (!wasmEmuRef.current) {
      setConsoleOutput((s) => s + 'No emulator instance to continue\n')
      return
    }

    const { bytes, errors, lineToAddr, addrToLine } = assemble(code)
    if (errors.length) {
      setConsoleOutput((s) => s + errors.map((e) => `ASM error: ${e}`).join('\n') + '\n')
      return
    }

    const programEnd = LOAD_ADDR + bytes.length

    setLineToAddr(lineToAddr)

    const emu = wasmEmuRef.current

    try {
      setPaused(false)

      const beforeEip1 = Number(emu.get_eip())
      const beforeSteps1 = Number(emu.get_steps())
      let stepCount = Number(emu.step())
      let eip = Number(emu.get_eip())

      if (eip < LOAD_ADDR || eip >= programEnd) {
        setSteps(stepCount)
        setCurrentLine(null)
        setPaused(false)
        setProgramFinished(true)
        setConsoleOutput((s) => s + 'Program finished. Reset to run again.\n')
        refreshRegistersFromWasm(emu)
        return
      }

      if (eip === beforeEip1 && stepCount === beforeSteps1) {
        setSteps(stepCount)
        setPaused(false)
        setProgramFinished(true)
        setConsoleOutput((s) => s + 'Program made no forward progress. Reset to run again.\n')
        refreshRegistersFromWasm(emu)
        return
      }

      const MAX_STEPS = 256

      for (let i = 0; i < MAX_STEPS; i++) {
        eip = Number(emu.get_eip())
        if (eip < LOAD_ADDR || eip >= programEnd) {
          setSteps(stepCount)
          setCurrentLine(null)
          setPaused(false)
          setProgramFinished(true)
          setConsoleOutput((s) => s + 'Program finished. Reset to run again.\n')
          refreshRegistersFromWasm(emu)
          return
        }
        const bp = breakpoints.get(eip)
        if (bp?.enabled) {
          const hitLine = bp.line ?? addrToLine.get(eip) ?? null
          setSteps(Number(emu.get_steps()))
          setCurrentLine(hitLine)
          setPaused(true)
          setProgramFinished(false)
          setConsoleOutput(
            (s) => s + `Paused at breakpoint on line ${hitLine ?? '?'} (EIP=0x${eip.toString(16).padStart(8, '0')})\n`
          )
          refreshRegistersFromWasm(emu)
          return
        }
        const beforeEip = Number(emu.get_eip())
        const beforeSteps = Number(emu.get_steps())
        stepCount = Number(emu.step())
        const afterEip = Number(emu.get_eip())

        if (afterEip < LOAD_ADDR || afterEip >= programEnd) {
          setSteps(stepCount)
          setCurrentLine(null)
          setPaused(false)
          setProgramFinished(true)
          setConsoleOutput((s) => s + 'Program finished. Reset to run again.\n')
          refreshRegistersFromWasm(emu)
          return
        }
        if (afterEip === beforeEip && stepCount === beforeSteps) {
          setSteps(stepCount)
          setPaused(false)
          setProgramFinished(true)
          setConsoleOutput((s) => s + 'Program made no forward progress. Reset to run again.\n')
          refreshRegistersFromWasm(emu)
          return
        }
      }

      setSteps(Number(emu.get_steps()))
      setCurrentLine(null)
      setPaused(false)
      setProgramFinished(true)
      setConsoleOutput((s) => s + 'Continue stopped after max steps.\n')
      refreshRegistersFromWasm(emu)
    } catch (e) {
      setConsoleOutput((s) => s + `WASM continue error: ${String(e)}\n`)
    }
  }

  function onReset() {
    setSteps(0)
    setHasRun(false)
    setProgramFinished(false)
    setPaused(false)
    setConsoleOutput('')
    setCurrentLine(null)
    setBreakpoints(new Map())
    if (wasmEmuRef.current) {
      try {
        wasmEmuRef.current.reset()
        refreshRegistersFromWasm(wasmEmuRef.current)
      } catch (e) {
        setConsoleOutput((s) => s + `WASM reset error: ${String(e)}\n`)
      }
      wasmEmuRef.current = null
    }

    setRegisters({ ...DEFAULT_REGISTERS })
    setFlags({ zf: 0, sf: 0, of: 0, cf: 0, df: 0, pf: 0 })
    setMemoryStartAddress(LOAD_ADDR)
    setMemoryStartInput('0x00001000')
    setMemoryByteCount(DEFAULT_MEMORY_BYTES)
    setMemoryByteCountInput(DEFAULT_MEMORY_BYTES)
    setMemoryView(createMemoryViewPlaceholder(LOAD_ADDR, DEFAULT_MEMORY_BYTES))
    setStackView([])
  }

function onOpenFileClick() {
  fileInputRef.current?.click()
}

function onLogout() {
  localStorage.removeItem('userRole')
  localStorage.removeItem('username')
  document.cookie = 'canvasAuth=; Max-Age=0; path=/'
  navigate('/login')
}

async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    setCode(text)
    setConsoleOutput((s) => s + `Opened file: ${file.name}\n`)
  } catch (err) {
    console.error(err)
    setConsoleOutput((s) => s + `Open file error: ${String(err)}\n`)
  } finally {
    e.target.value = ''
  }
}

function downloadTextFile(content: string, filename: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  URL.revokeObjectURL(url)
}

function onSave() {
  downloadTextFile(code, 'program.asm')
  setConsoleOutput((s) => s + 'Saved editor contents as program.asm\n')
}

function onSaveAs() {
  const fileChoice = window.prompt('Save as: example.asm or example.txt', 'program')
  if (!fileChoice) return

  const trimmed = fileChoice.trim()
  const lower = trimmed.toLowerCase()

  if (!lower.endsWith('.asm') && !lower.endsWith('.txt')) {
    setConsoleOutput((s) => s + 'Save As cancelled: File type must be asm or txt.\n')
    return
  }

  downloadTextFile(code, trimmed)
  setConsoleOutput((s) => s + `Saved editor contents as ${trimmed}\n`)
}

  function refreshRegistersFromWasm(
    emu: EmulatorApi,
    options?: { memoryStart?: number; memoryBytes?: number },
  ) {
    try {
      const eip = formatRegisterValue(emu.get_eip())
      const eax = formatRegisterValue(emu.get_eax())
      const ebx = formatRegisterValue(emu.get_ebx())
      const ecx = formatRegisterValue(emu.get_ecx())
      const edx = formatRegisterValue(emu.get_edx())
      const ebp = formatRegisterValue(emu.get_ebp())
      const esp = formatRegisterValue(emu.get_esp())
      const esi = formatRegisterValue(emu.get_esi())
      const edi = formatRegisterValue(emu.get_edi())

      setRegistersCommitted({ eip, eax, ebx, ecx, edx, ebp, esp, esi, edi })

      const zf = emu.get_zf() ? 1 : 0
      const sf = emu.get_sf() ? 1 : 0
      const of = emu.get_of() ? 1 : 0
      const cf = emu.get_cf() ? 1 : 0
      const pf = emu.get_pf() ? 1 : 0
      // DF is not implemented in core; keep 0 for now
      const df = 0

      // update flags panel
      setFlags({ zf, sf, of, cf, df, pf })

      const memoryStart = (options?.memoryStart ?? memoryStartAddress) >>> 0
      const memoryBytes = options?.memoryBytes ?? memoryByteCount

      // Read the selected memory range if emulator exposes read_u8
      try {
        const emuUnknown = emu as unknown as {
          read_u8?: (addr: number) => number
          read_u32?: (addr: number) => number
        }
        if (typeof emuUnknown.read_u8 === 'function') {
          const bytes: MemoryCell[] = []
          for (let i = 0; i < memoryBytes; i++) {
            const addr = (memoryStart + i) >>> 0
            try {
              const v = emuUnknown.read_u8(addr)
              bytes.push({
                address: addr,
                value: Number(v) & 0xFF,
              })
            } catch {
              bytes.push({
                address: addr,
                value: null,
              })
            }
          }
          setMemoryView(bytes)
        } else {
          setMemoryView(createMemoryViewPlaceholder(memoryStart, memoryBytes))
        }

        if (typeof emuUnknown.read_u32 === 'function') {
          const stackRows: StackViewRow[] = []
          const espNum = Number(emu.get_esp()) >>> 0
          for (let i = 0; i < STACK_VIEW_ROWS; i++) {
            const addr = (espNum + i * 4) >>> 0
            try {
              const val = emuUnknown.read_u32(addr)
              stackRows.push({
                address: formatRegisterValue(addr),
                value: formatRegisterValue(val),
                isTop: i === 0,
                unreadable: false,
              })
            } catch {
              stackRows.push({
                address: formatRegisterValue(addr),
                value: '--',
                isTop: i === 0,
                unreadable: true,
              })
            }
          }
          setStackView(stackRows)
        } else {
          setStackView([])
        }
      } catch (e) {
        setConsoleOutput((s) => s + `${String(e)}\n`)
      }
    } catch (e) {
      setConsoleOutput((s) => s + `WASM refresh error: ${String(e)}\n`)
    }

  }

  function toggleBreakpointForLine(lineNo: number) {
    const addr = lineToAddr.get(lineNo)
    if (addr == null) return
    setBreakpoints((prev) => {
      const next = new Map(prev)
      if (next.has(addr)) {
        next.delete(addr)
      } else {
        next.set(addr, {
          address: addr,
          enabled: true,
          line: lineNo,
        })
      }
      return next
    })
  }
  
  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">ASU</div>
        <button className="labs-nav-btn" onClick={() => navigate('/lab1')}>Lab View</button>
        <div className="title">Online Assembly x86 Emulator</div>
        <div style={{ marginLeft: 'auto', paddingRight: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.9rem' }}>
          <span>
            {userRole === 'admin' ? 'Instructor/Admin' : 'Student'}: {username}
          </span>
        </div>
        <div className="toolbar">
          <button
            type="button"
            onClick={() => window.open(userDocumentationPdf, '_blank', 'noopener,noreferrer')}
          >
            Tutorial
          </button>
          <button onClick={onOpenFileClick}>Open</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={onFileSelected}
            style={{ display: "none" }}
          />
          <button onClick={onSave}>Save</button>
          <button onClick={onSaveAs}>Save as</button>
          <button onClick={onLogout} style={{ background: '#ff0000', color: '#ffffff' }}>Logout</button>
        </div>
      </header>

      <DebugBar
        onRun={onRun}
        onStep={onStep}
        onContinue={onContinue}
        onReset={onReset}
        hasRun={hasRun}
        programFinished={programFinished}
        paused={paused}
      />

      <main className="main-grid">
        <section className="editor-pane">
          <div className="editor-header">
            <span>Assembly Editor</span>
            <div className="editor-zoom-controls" role="group" aria-label="Assembly editor zoom controls">
              <button
                type="button"
                className="editor-zoom-button"
                onClick={zoomOutEditor}
                disabled={editorZoom <= MIN_EDITOR_ZOOM}
                aria-label="Zoom out assembly editor"
              >
                -
              </button>
              <span className="editor-zoom-value" aria-live="polite">{editorZoom}%</span>
              <button
                type="button"
                className="editor-zoom-button"
                onClick={zoomInEditor}
                disabled={editorZoom >= MAX_EDITOR_ZOOM}
                aria-label="Zoom in assembly editor"
              >
                +
              </button>
            </div>
          </div>
          <div
            className='editor-wrap'
            style={{
              ['--editor-line-height' as string]: `${editorLineHeight}px`,
              ['--editor-gutter-width' as string]: `${editorGutterWidth}px`,
              ['--editor-gutter-font-size' as string]: `${editorGutterFontSize}px`,
              ['--editor-gutter-top-padding' as string]: `${editorGutterTopPadding}px`,
              ['--editor-line-no-width' as string]: `${editorLineNoWidth}px`,
            }}
          >
            <div 
              className='gutter'
              ref={gutterScrollRef}
              aria-label="Breakpoint gutter"
            >
              {lines.map((_, idx) => {
                const lineNo = idx + 1
                const addr = lineToAddr.get(lineNo)
                const isExecutable = addr != null
                const hasBreakpoint = addr != null && breakpoints.has(addr)
                return (
                  <div
                    key={lineNo}
                    className={`gutter-line ${
                      !isExecutable ? 'non-executable' : ''
                    } ${currentLine === lineNo ? 'current-line' : ''} ${
                      currentLine === lineNo && hasBreakpoint ? 'break-hit' : ''
                    }`}
                    onClick={() => {
                      if (isExecutable) toggleBreakpointForLine(lineNo)
                    }}
                    title={
                      !isExecutable
                        ? `Line ${lineNo} is not executable`
                        : hasBreakpoint
                          ? `Remove breakpoint at line ${lineNo}`
                          : `Add breakpoint at line ${lineNo}`
                    }
                    role="button"
                    tabIndex={0}
                    style={{ height: `${editorLineHeight}px` }}
                  >
                    <span className={`bp-dot ${hasBreakpoint ? 'on' : ''}`} />
                    <span className="line-no">{lineNo}</span>
                  </div>
                )
              })}
              </div>
              <textarea
            className="editor"
            ref={editorScrollRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onScroll={(e) => {
              const el = e.currentTarget
              if(gutterScrollRef.current) {
                gutterScrollRef.current.scrollTop = el.scrollTop
              }
            }}
            spellCheck={false}
            wrap="off"
            aria-label="Assembly editor"
            style={{
              fontSize: `${editorFontSize}px`,
              lineHeight: `${editorLineHeight}px`,
              padding: `${editorPaddingY}px ${editorPaddingX}px`,
            }}
          />
          </div>
        </section>

        <aside className="sidebar">
          <p className="steps-counter">Steps: {steps}{paused ? ' (Paused at breakpoint)' : ''}</p>
          <div className="panel-heading">Registers</div>
          <div className="registers">
            <div className="reg-row">
              <span className="reg-name">EIP</span>
              <input
                className="reg-val reg-input"
                value={registers.eip}
                onChange={(e) => onRegisterInputChange('eip', e.target.value)}
                onBlur={() => commitRegister('eip')}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label="EIP register"
              />
            </div>
            <div className="reg-row">
              <span className="reg-name">EAX</span>
              <input
                className="reg-val reg-input"
                value={registers.eax}
                onChange={(e) => onRegisterInputChange('eax', e.target.value)}
                onBlur={() => commitRegister('eax')}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label="EAX register"
              />
            </div>
            <div className="reg-row">
              <span className="reg-name">EBX</span>
              <input
                className="reg-val reg-input"
                value={registers.ebx}
                onChange={(e) => onRegisterInputChange('ebx', e.target.value)}
                onBlur={() => commitRegister('ebx')}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label="EBX register"
              />
            </div>
            <div className="reg-row">
              <span className="reg-name">ECX</span>
              <input
                className="reg-val reg-input"
                value={registers.ecx}
                onChange={(e) => onRegisterInputChange('ecx', e.target.value)}
                onBlur={() => commitRegister('ecx')}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label="ECX register"
              />
            </div>
            <div className="reg-row">
              <span className="reg-name">EDX</span>
              <input
                className="reg-val reg-input"
                value={registers.edx}
                onChange={(e) => onRegisterInputChange('edx', e.target.value)}
                onBlur={() => commitRegister('edx')}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label="EDX register"
              />
            </div>
            <div className="reg-row">
              <span className="reg-name">EBP</span>
              <input
                className="reg-val reg-input"
                value={registers.ebp}
                onChange={(e) => onRegisterInputChange('ebp', e.target.value)}
                onBlur={() => commitRegister('ebp')}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label="EBP register"
              />
            </div>
            <div className="reg-row">
              <span className="reg-name">ESP</span>
              <input
                className="reg-val reg-input"
                value={registers.esp}
                onChange={(e) => onRegisterInputChange('esp', e.target.value)}
                onBlur={() => commitRegister('esp')}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label="ESP register"
              />
            </div>
            <div className="reg-row">
              <span className="reg-name">ESI</span>
              <input
                className="reg-val reg-input"
                value={registers.esi}
                onChange={(e) => onRegisterInputChange('esi', e.target.value)}
                onBlur={() => commitRegister('esi')}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label="ESI register"
              />
            </div>
            <div className="reg-row">
              <span className="reg-name">EDI</span>
              <input
                className="reg-val reg-input"
                value={registers.edi}
                onChange={(e) => onRegisterInputChange('edi', e.target.value)}
                onBlur={() => commitRegister('edi')}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label="EDI register"
              />
            </div>
          </div>

          <div className="panel-heading" style={{ marginTop: 12 }}>Flags</div>
          <div className="registers">
            <div className="reg-row"><span className="reg-name">ZF</span><span className="reg-val">{flags.zf}</span></div>
            <div className="reg-row"><span className="reg-name">SF</span><span className="reg-val">{flags.sf}</span></div>
            <div className="reg-row"><span className="reg-name">0F</span><span className="reg-val">{flags.of}</span></div>
            <div className="reg-row"><span className="reg-name">CF</span><span className="reg-val">{flags.cf}</span></div>
            <div className="reg-row"><span className="reg-name">DF</span><span className="reg-val">{flags.df}</span></div>
            <div className="reg-row"><span className="reg-name">PF</span><span className="reg-val">{flags.pf}</span></div>
          </div>

          <div className="panel-heading" style={{ marginTop: 12 }}>
            Memory <span className="mem-addr-label">@ {formatRegisterValue(memoryStartAddress)} ({memoryByteCount} bytes)</span>
          </div>
          <div className="mem-controls">
            <label className="mem-control">
              <span className="mem-control-label">Start</span>
              <input
                className="reg-val reg-input mem-range-input"
                value={memoryStartInput}
                onChange={(e) => setMemoryStartInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyMemoryRange() }}
                aria-label="Memory range start address"
              />
            </label>
            <label className="mem-control">
              <span className="mem-control-label">Bytes</span>
              <select
                className="mem-range-select"
                value={memoryByteCountInput}
                onChange={(e) => onMemoryByteCountChange(Number(e.target.value))}
                aria-label="Memory range byte count"
              >
                {MEMORY_BYTE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <button type="button" className="mem-apply-btn" onClick={applyMemoryRange}>Apply</button>
          </div>
          <div className="memory-grid" role="grid" aria-label="Memory view">
            {memoryView.map((cell, i) => (
              <div
                key={`${cell.address}-${i}`}
                className={`mem-cell${cell.value == null ? ' mem-cell-unreadable' : ''}`}
                role="gridcell"
                aria-label={`Byte ${i}`}
                title={formatRegisterValue(cell.address)}
              >
                {cell.value == null ? '--' : cell.value.toString(16).toUpperCase().padStart(2, '0')}
              </div>
            ))}
          </div>

          <div className="panel-heading" style={{ marginTop: 12 }}>
            Stack <span className="mem-addr-label">(top at ESP)</span>
          </div>
          <div className="stack-table" aria-label="Stack view">
            {stackView.length === 0 && (
              <div className="stack-empty">Run or Step to load stack view.</div>
            )}
            {stackView.map((row) => (
              <div key={row.address} className={`stack-row${row.isTop ? ' top' : ''}`}>
                <span className="stack-address">{row.address}</span>
                <span className={`stack-value${row.unreadable ? ' unreadable' : ''}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section className="console-pane">
          <div className="console-header">Console
            <button className='copy-btn' onClick={async () => {
              try {
                await navigator.clipboard.writeText(consoleOutput)
                setConsoleOutput((s) => s + 'Copied console to clipboard.\n')
              }
              catch {
                //nothing
              }
            }} type = "button">
              Copy
            </button>
          </div>
          <pre className="console-output" role="log" aria-live="polite">{consoleOutput}</pre>
        </section>
      </main>
    </div>
  )
}
