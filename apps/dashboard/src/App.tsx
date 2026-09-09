import { useState } from "react"

import { MatchRail } from "@/components/match-rail.tsx"
import { resolvedBroadcastStatus, useBroadcastStatus } from "@/components/broadcast-status.tsx"
import { AppearancePage } from "@/pages/Appearance.tsx"
import { OverlayPage } from "@/pages/Overlay.tsx"
import { PlayersPage } from "@/pages/Players.tsx"
import { SetupPage } from "@/pages/Setup.tsx"

type Page = "overlay" | "players" | "appearance" | "setup"

const PAGES: readonly Page[] = ["overlay", "players", "appearance", "setup"]

function pageFromSearch(): Page {
  const value = new URLSearchParams(window.location.search).get("page")
  return PAGES.find((page) => page === value) ?? "overlay"
}

export function App() {
  const [page, setPage] = useState<Page>(pageFromSearch)
  const statusQuery = useBroadcastStatus()
  const status = resolvedBroadcastStatus(
    statusQuery.data,
    statusQuery.isError,
    statusQuery.isPending
  )

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

  const rail = (
    <MatchRail status={status} loading={statusQuery.isPending} />
  )

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground lg:flex-row">
      <header className="sticky top-0 z-20 border-b border-border bg-background lg:hidden">
        <div className="flex h-12 items-center px-4">
          <p className="mf-wordmark text-muted-foreground">MATCHFRAME</p>
        </div>
        <Nav page={page} onOpen={openPage} layout="top" />
      </header>

      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-5 lg:flex">
        <p className="mf-wordmark text-muted-foreground">MATCHFRAME</p>
        <Nav page={page} onOpen={openPage} layout="side" />
        <div className="mt-auto border-t border-border pt-4">{rail}</div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="border-b border-border px-4 py-3 lg:hidden">{rail}</div>
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          {page === "overlay" ? (
            <OverlayPage />
          ) : page === "players" ? (
            <PlayersPage />
          ) : page === "appearance" ? (
            <AppearancePage />
          ) : (
            <SetupPage />
          )}
        </main>
      </div>
    </div>
  )
}

function Nav({
  page,
  onOpen,
  layout,
}: {
  page: Page
  onOpen: (page: Page) => void
  layout: "side" | "top"
}) {
  return (
    <nav
      className={
        layout === "top"
          ? "flex h-12 items-center px-2"
          : "mt-8 flex flex-col gap-1"
      }
      aria-label="Dashboard"
    >
      <NavItem
        active={page === "overlay"}
        layout={layout}
        onClick={() => onOpen("overlay")}
      >
        Overlay
      </NavItem>
      <NavItem
        active={page === "players"}
        layout={layout}
        onClick={() => onOpen("players")}
      >
        Players
      </NavItem>
      <NavItem
        active={page === "appearance"}
        layout={layout}
        onClick={() => onOpen("appearance")}
      >
        Appearance
      </NavItem>
      <NavItem
        active={page === "setup"}
        layout={layout}
        onClick={() => onOpen("setup")}
      >
        Setup
      </NavItem>
    </nav>
  )
}

function NavItem({
  active,
  onClick,
  children,
  layout,
}: {
  active: boolean
  onClick: () => void
  children: string
  layout: "side" | "top"
}) {
  const edge =
    layout === "top"
      ? "flex-1 border-b-2 py-2 text-center"
      : "block border-l-2 py-1 pl-3 text-left"
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`${edge} text-sm ${
        active
          ? "border-primary font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
