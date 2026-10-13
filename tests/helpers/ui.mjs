// Observe actual DOM changes instead of adding a polling delay after every UI operation.
export function waitForUI(predicate, { root, label, timeoutMs = 3000, failure } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false
    const Observer = root.ownerDocument.defaultView.MutationObserver
    const observer = new Observer(check)
    const timer = setTimeout(() => {
      const state = root.textContent.trim().replace(/\s+/g, ' ').slice(-500)
      finish(new Error(`${label}: UI did not settle within ${timeoutMs}ms. Current UI: ${state}`))
    }, timeoutMs)
    function finish(error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      observer.disconnect()
      if (error) reject(error)
      else resolve()
    }
    function check() {
      try {
        if (predicate()) finish()
        else {
          const reason = failure?.()
          if (reason) finish(new Error(`${label}: ${reason}`))
        }
      } catch (error) { finish(error) }
    }
    observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true })
    check()
  })
}

// A failed MCP close must not prevent HTTP, DOM and Vite from being closed as well.
export async function cleanupResources(resources) {
  const entries = Object.entries(resources)
  const results = await Promise.allSettled(entries.map(([, close]) => Promise.resolve().then(close)))
  const errors = results.flatMap((result, index) => result.status === 'rejected'
    ? [new Error(`Failed to close ${entries[index][0]}`, { cause: result.reason })] : [])
  if (errors.length) throw new AggregateError(errors, 'Integration test cleanup failed')
}
