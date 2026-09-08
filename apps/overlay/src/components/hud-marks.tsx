export function HeartMark({ size = "size-3" }: { size?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`${size} shrink-0 fill-current`} aria-hidden="true">
      <path d="M8 14s-5.2-3.2-6.6-6.1C.4 6.1.8 3.7 2.8 2.8 4.2 2.2 5.7 2.7 8 5c2.3-2.3 3.8-2.8 5.2-2.2 2 .9 2.4 3.3 1.4 5.1C13.2 10.8 8 14 8 14z" />
    </svg>
  )
}

export function CrosshairMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3 shrink-0 fill-current" aria-hidden="true">
      <path d="M7.25 1h1.5v4.2h-1.5zM7.25 10.8h1.5V15h-1.5zM1 7.25h4.2v1.5H1zM10.8 7.25H15v1.5h-4.2zM6.2 6.2h3.6v3.6H6.2z" />
    </svg>
  )
}

export function SkullMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3 shrink-0 fill-current" aria-hidden="true">
      <path d="M8 1.4A5.6 5.6 0 0 0 2.4 7c0 2 1.1 3.3 2.2 4.1V14h2.1v-1.2h1.6V14h2.1v-2.9c1.1-.8 2.2-2.1 2.2-4.1A5.6 5.6 0 0 0 8 1.4zM5.7 7.4a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm4.6 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2z" />
    </svg>
  )
}
