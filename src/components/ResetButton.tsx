export function ResetButton({ onReset }: { onReset(): void }) {
  return (
    <button type="button" className="toolbar-button" onClick={onReset}>
      Reset level
    </button>
  )
}
