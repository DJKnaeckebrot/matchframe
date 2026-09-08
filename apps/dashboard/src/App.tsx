import { useState } from "react"

import { AppearancePage } from "@/pages/Appearance.tsx"
import { OverlayPage } from "@/pages/Overlay.tsx"
import { PlayersPage } from "@/pages/Players.tsx"

type Page = "overlay" | "players" | "appearance"

const PAGES: readonly Page[] = ["overlay", "players", "appearance"]

function pageFromSearch(): Page {
  const value = new URLSearchParams(window.location.search).get("page")
  return PAGES.find((page) => page === value) ?? "overlay"
}

export function App() {
  const [page, setPage] = useState<Page>(pageFromSearch)

  function openPage(next: Page) {
    setPage(next)
    const url = new URL(window.location.href)
    if (next === "overlay") {
      url.searchParams.delete("page")
    } else {
      url.searchParams.set("page", next)
    }
    window.history.replaceState(null, "", url)
  }

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside className="flex w-52 shrink-0 flex-col border-r border-border px-4 py-5">
        <div className="text-[11px] tracking-[0.28em] text-muted-foreground">
          MATCHFRAME
        </div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Dashboard">
          <NavItem active={page === "overlay"} onClick={() => openPage("overlay")}>
            Overlay
          </NavItem>
          <NavItem active={page === "players"} onClick={() => openPage("players")}>
            Players
          </NavItem>
          <NavItem active={page === "appearance"} onClick={() => openPage("appearance")}>
            Appearance
          </NavItem>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-6">
        {page === "overlay" ? (
          <OverlayPage />
        ) : page === "players" ? (
          <PlayersPage />
        ) : (
          <AppearancePage />
        )}
      </main>
    </div>
  )
}

function NavItem({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block border-l-2 py-1 pl-3 text-left text-sm ${
        active
          ? "border-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
