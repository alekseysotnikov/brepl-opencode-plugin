# brepl opencode plugin

[Brepl](https://github.com/licht1stein/brepl) integration for OpenCode - automatic Clojure syntax validation, auto-fix, and REPL evaluation.

## Features

-  **Pre-edit Validation** - Validates Clojure syntax before files are written
-  **Auto-Correction** - Fixes mismatched brackets
-  **Post-edit Evaluation** - Evaluates files in running nREPL server

Detailed `brepl` features [here](https://github.com/licht1stein/brepl?tab=readme-ov-file#what-is-brepl).

## Installation

### 1. Install brepl

Follow [instruction](https://github.com/licht1stein/brepl?tab=readme-ov-file#installation)

### 2. Install Plugin

#### Global (default)
```bash
./install.sh
```

#### Local project
```
./install.sh /path/to/project
```

#### Manually
Copy `brepl.js` file to either Global plugin directory (`~/.config/opencode/plugins/`)
or Project plugin directory (`.opencode/plugins/`)

## Usage

```bash
# Just run in your project dir
opencode
```

Plugin automatically validates and fixes Clojure files on Edit/Write.

## Architecture

```
OpenCode Starts
       ↓
session.created (capture sessionId)
       ↓
┌────────────────────────────────────┐
│  Edit/Write Clojure File           | 
├────────────────────────────────────┤
│  tool.execute.before (Event)       │
│       ↓                            │
│  brepl hook validate (stdin)       │
│       ↓                            │
│  Valid? → Allow + Apply correction │
└────────────────────────────────────┘
       ↓
File Written
       ↓
┌────────────────────────────────────┐
│  tool.execute.after (Event)        │
│       ↓                            │
│  brepl hook eval (with sessionId)  │
│       ↓                            │
│  Report results                    │
└────────────────────────────────────┘
       ↓
session.deleted (cleanup backups)
```

## License
No license
