export function PageStatus({
  children,
  tone = "muted",
}: {
  children: string
  tone?: "muted" | "ok" | "bad"
}) {
  if (tone === "ok") {
    return (
      <p role="status" className="border-l-2 border-primary pl-3 text-sm text-foreground">
        {children}
      </p>
    )
  }

  if (tone === "bad") {
    return (
      <p role="status" className="border-l-2 border-destructive pl-3 text-sm text-destructive">
        {children}
      </p>
    )
  }

  return (
    <p role="status" className="text-sm text-muted-foreground">
      {children}
    </p>
  )
}
