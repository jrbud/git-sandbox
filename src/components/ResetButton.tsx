export function ResetButton({ onReset }: { onReset(): void }) {
  return (
    <button type="button" className="toolbar-button" onClick={onReset}>
      <span aria-hidden="true">↺ </span>
      Reset level
    </button>
  )
}
