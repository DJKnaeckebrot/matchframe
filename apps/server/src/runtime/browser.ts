export function openDashboard(url: string, platform = process.platform): void {
  try {
    if (platform === "win32") {
      Bun.spawn(["cmd", "/c", "start", "", url], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      })
      return
    }
    if (platform === "darwin") {
      Bun.spawn(["open", url], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
      return
    }
    Bun.spawn(["xdg-open", url], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
  } catch {
    // Opening a browser is best-effort. The server stays up either way.
  }
}
