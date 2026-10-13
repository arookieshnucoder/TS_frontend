import { checkBackend } from '../tests/helpers/backend.mjs'

try {
  const { directory } = await checkBackend()
  console.log(`Integration backend ready: ${directory}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
