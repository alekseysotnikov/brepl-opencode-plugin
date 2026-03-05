// brepl-opencode-plugin - Clojure validation for OpenCode
const { exec } = require("child_process")
const { promisify } = require("util")
const execAsync = promisify(exec)

const CLOJURE_EXTS = [".clj", ".cljs", ".cljc", ".cljx", "bb"]
const isClojure = (path) => CLOJURE_EXTS.includes("." + path.split(".").pop()?.toLowerCase())

const runHook = (cmd, input) =>
  execAsync(cmd, { input: JSON.stringify(input), timeout: 30000, env: process.env })
    .then(r => r.stdout.trim())
    .then(out => out.startsWith("{") ? JSON.parse(out) : null)
    .catch(e => {
      if (e.code === 1 || e.status === 1) {
        try { return JSON.parse(e.stdout || e.stderr) } catch { return null }
      }
      return null
    })

module.exports.BreplPlugin = async () => {
  let sessionId = null

  return {
    "session.created": async (_, out) => { sessionId = out.session.id },

    "tool.execute.before": async (inp, out) => {
      if (!["Edit", "Write"].includes(inp.tool)) return
      const args = out.args
      const filePath = args.filePath || args.path
      if (!filePath || !isClojure(filePath)) return
      const content = inp.tool === "Write" ? args.content : args.newString || args.new_string
      if (!content) return

      const result = await runHook("brepl hook validate", {
        tool_name: inp.tool,
        tool_input: { file_path: filePath, content }
      })

      if (result?.hookSpecificOutput) {
        const { permissionDecision, updatedInput } = result.hookSpecificOutput
        if (permissionDecision === "deny") throw new Error(`Syntax error in ${filePath}`)
        if (updatedInput?.content) {
          console.log(`[brepl] Auto-fixed ${filePath}`)
          args.content = updatedInput.content
        }
      }
    },

    "tool.execute.after": async (inp, out) => {
      if (!["Edit", "Write"].includes(inp.tool)) return
      const args = out.args
      const filePath = args.filePath || args.path
      if (!filePath || !isClojure(filePath)) return

      const result = await runHook("brepl hook eval", {
        tool_name: inp.tool,
        tool_input: { file_path: filePath },
        session_id: sessionId
      })

      if (result?.hookSpecificOutput?.permissionDecisionReason) {
        console.log(`[brepl] ${result.hookSpecificOutput.permissionDecisionReason}`)
      }
    },

    "session.deleted": async () => {
      if (sessionId) await runHook("brepl hook session-end", { session_id: sessionId }).catch(() => {})
    },
  }
}

module.exports.default = module.exports.BreplPlugin
