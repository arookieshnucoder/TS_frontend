import { createServer } from 'vite'

export function createTestServer({ vue = false, chatMode = 'backend' } = {}) {
  let compiler
  return createServer({
    configFile: false,
    define: { 'import.meta.env.VITE_CHAT_MODE': JSON.stringify(chatMode) },
    ssr: { external: true },
    // These tests load modules through SSR; there is no browser dependency bundle or HMR client.
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: 'custom',
    plugins: vue ? [{
      name: 'vue-integration-test',
      async transform(source, id) {
        if (!id.endsWith('.vue')) return
        compiler ??= Promise.all([import('typescript'), import('@vue/compiler-sfc')])
        const [{ default: ts }, { parse, compileScript }] = await compiler
        const { descriptor } = parse(source, { filename: id })
        const compiled = compileScript(descriptor, { id, inlineTemplate: true })
        return { code: ts.transpileModule(compiled.content, {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        }).outputText }
      },
    }] : [],
  })
}
