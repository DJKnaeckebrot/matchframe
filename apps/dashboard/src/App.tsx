import { AppearancePage } from "@/pages/Appearance.tsx"

export function App() {
  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside className="flex w-52 shrink-0 flex-col border-r border-border px-4 py-5">
        <div className="text-[11px] tracking-[0.28em] text-muted-foreground">
          MATCHFRAME
        </div>
        <nav className="mt-8" aria-label="Dashboard">
          <span className="block border-l-2 border-foreground pl-3 text-sm font-medium">
            Appearance
          </span>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-6">
        <AppearancePage />
      </main>
    </div>
  )
}
