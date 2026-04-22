interface DebugBarProps {
    onRun: () => void
    onStep: () => void
    onContinue: () => void
    onReset: () => void
    hasRun: boolean
    programFinished: boolean
    paused: boolean
}

export default function DebugBar({
  onRun,
  onStep,
  onContinue,
  onReset,
  hasRun,
  programFinished,
  paused,
}: DebugBarProps) {
  return (
    <div className='debugbar'>
      <button onClick={onRun} className="primary" disabled={hasRun}>Run</button>
      <button onClick={onStep} disabled={programFinished}>Step</button>
      <button onClick={onContinue} disabled={!paused || programFinished}>Continue</button>
      <button onClick={onReset}>Reset</button>
    </div>
  )
}