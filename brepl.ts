// brepl-opencode-plugin - Clojure validation for OpenCode
import type { Plugin } from "@opencode-ai/plugin"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)
const BREPL_PATH = process.env.BREPL_PATH || "brepl"
const LOG_FILE = `${process.cwd()}/brepl-debug.log`
const DEBUG_ENABLED = process.env.BREPL_DEBUG === "1" || process.env.BREPL_DEBUG === "true"

// File logging (only when BREPL_DEBUG=1)
const fileLog = (msg: string, data?: unknown) => {
  if (!DEBUG_ENABLED) return
  try {
    const line = `[${new Date().toISOString()}] ${msg}${data ? "\n" + JSON.stringify(data, null, 2) : ""}\n`
    require("fs").appendFileSync(LOG_FILE, line)
  } catch (e) {
    console.error("[brepl] File log error:", (e as Error).message)
  }
}

export const BreplPlugin: Plugin = async ({ client }) => {
  let sessionId: string | null = null

  // Log to OpenCode + optional file
  const log = async (msg: string, data?: unknown) => {
    fileLog(msg, data)
    try {
      client?.app?.log({ body: { service: "brepl", level: "info", message: data ? `${msg} ${JSON.stringify(data)}` : msg } })
    } catch (e) {
      fileLog("[OpenCode log error]", { message: (e as Error).message })
    }
  }

  // Capitalize first letter: "write" -> "Write"
  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""

  // Execute brepl hook command
  const runHook = async (cmd: string, input: { tool_name?: string } & Record<string, unknown>) => {
    const toolName = capitalize(input.tool_name || "")
    const cmdInput = { ...input, tool_name: toolName }
    const fullCmd = `echo '${JSON.stringify(cmdInput).replace(/'/g, "'\\''")}' | ${BREPL_PATH} ${cmd}`

    await log(`[runHook] Executing: ${fullCmd}`, { input, cwd: process.cwd() })

    try {
      const result = await execAsync(fullCmd, { timeout: 60000, maxBuffer: 10 * 1024 * 1024, env: process.env })
      const output = String(result.stdout).trim()
      await log(`[runHook] Success: ${fullCmd}`, { stdout: output })
      return output.startsWith("{") ? JSON.parse(output) : null
    } catch (e) {
      const err = e as { code?: number; status?: number; stdout?: string; stderr?: string; message: string }
      await log(`[runHook] Error: ${fullCmd}`, { code: err.code, status: err.status, stdout: err.stdout, stderr: err.stderr, message: err.message })
      if (err.code === 1 || err.status === 1) {
        try { return JSON.parse(err.stdout || err.stderr) } catch { return null }
      }
      return null
    }
  }

  // Extract args from hook output
  const getArgs = (out?: { args?: Record<string, unknown> }) => out?.args as Record<string, unknown> | undefined

  await log("[BreplPlugin] Plugin initialized")

  return {
    "session.created": async (_, out) => {
      sessionId = out.session.id
      await log("[session.created]", { sessionId })
    },

    "tool.execute.before": async (inp, out) => {
      const tool = (inp.tool || "").toLowerCase()
      if (!["edit", "write"].includes(tool)) return

      const args = getArgs(out)
      const filePath = args?.filePath || args?.path
      if (!filePath) return

      const content = tool === "write" ? args?.content : args?.newString || args?.new_string
      if (!content) return

      await log("[tool.execute.before] Validating", { tool: inp.tool, filePath })
      const result = await runHook("hooks validate", {
        tool_name: inp.tool,
        tool_input: { file_path: filePath, content }
      })

      await log("[tool.execute.before] Validation result", result)
      if (result?.hookSpecificOutput) {
        const { permissionDecision, updatedInput } = result.hookSpecificOutput
        if (permissionDecision === "deny") throw new Error(`Syntax error in ${filePath}`)
        if (updatedInput?.content && args) {
          await log("[tool.execute.before] Auto-fixed", { filePath })
          args.content = updatedInput.content
        }
      }
    },

    "tool.execute.after": async (inp, out) => {
      const tool = (inp.tool || "").toLowerCase()
      if (!["edit", "write"].includes(tool)) return

      const args = getArgs(out)
      const filePath = args?.filePath || args?.path
      if (!filePath) return

      await log("[tool.execute.after] Evaluating", { tool: inp.tool, filePath, sessionId })
      const result = await runHook("hooks eval", {
        tool_name: inp.tool,
        tool_input: { file_path: filePath },
        session_id: sessionId
      })
      await log("[tool.execute.after] Evaluation result", result)
    },

    "session.deleted": async () => {
      await log("[session.deleted]", { sessionId })
      if (sessionId) await runHook("hooks session-end", { session_id: sessionId }).catch(() => {})
    },
  }
}

export default BreplPlugin
