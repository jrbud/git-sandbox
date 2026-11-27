export interface ObjectiveBannerProps {
  title: string
  objective: string
  completed?: boolean
}

export function ObjectiveBanner({ title, objective, completed = false }: ObjectiveBannerProps) {
  return (
    <section
      className={`objective-banner${completed ? ' is-complete' : ''}`}
      aria-label="Objective"
    >
      <h1 className="objective-title">{title}</h1>
      <p className="objective-text">
        <span className="objective-status">
          <span aria-hidden="true">{completed ? '✔ ' : '◎ '}</span>
          {completed ? 'Complete:' : 'Goal:'}
        </span>{' '}
        {objective}
      </p>
    </section>
  )
}
