import { useId, useState } from 'react'
import type { CheatsheetEntry } from '../content/types'

/** A toggleable quick reference. Renders nothing for levels without a cheatsheet (variations). */
export function Cheatsheet({ entries }: { entries?: CheatsheetEntry[] }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  if (!entries || entries.length === 0) return null

  return (
    <div className="cheatsheet">
      <button
        type="button"
        className="toolbar-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide cheatsheet' : 'Cheatsheet'}
      </button>
      {open && (
        <section id={panelId} className="panel cheatsheet-panel" aria-label="Cheatsheet">
          <table>
            <thead>
              <tr>
                <th scope="col">Command</th>
                <th scope="col">What it does</th>
                <th scope="col">Example</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.command}>
                  <td>
                    <code>{entry.command}</code>
                  </td>
                  <td>{entry.description}</td>
                  <td>
                    <code>{entry.example}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
