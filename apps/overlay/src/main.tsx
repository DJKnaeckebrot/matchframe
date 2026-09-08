import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Overlay } from "./components/Overlay"
import "./index.css"
import { startRealtimeClient } from "./realtime/client"

startRealtimeClient()

const root = document.getElementById("root")
if (!root) {
  throw new Error("root element missing")
}

createRoot(root).render(
  <StrictMode>
    <Overlay />
  </StrictMode>
)
