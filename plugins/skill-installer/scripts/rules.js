// customs:rules-file
'use strict';
/*
 * Customs rule table. Pure data plus tiny matchers, no I/O.
 * This file declares the marker above on line 1 because it must contain the very patterns it detects.
 * scan.js honors the marker ONLY for files inside its own install root and always lists the exclusion
 * in its output, so a hostile package cannot hide behind it.
 *
 * Rule fields
 *   id, cat, sev      identity and default severity
 *   kinds             file kinds the rule applies to: script, config, agentmd, doc, other
 *   re | fn           line matcher (RegExp, or fn(line) -> truthy)
 *   pre               optional cheap RegExp that must match first (keeps the heavy regex off lines that cannot match)
 *   exec              command-style rule: weighted down inside markdown (see capFor in scan.js)
 *   inj               prompt-injection rule: phrased-as-instruction detection, weighted down in docs
 *   mdCap             highest severity this exec rule may reach in agent markdown (default MEDIUM)
 *   msg               one-line explanation
 */

const SC = ['script', 'config', 'other'];
const ALL = ['script', 'config', 'other', 'agentmd', 'doc'];
const MD = ['agentmd', 'doc'];

const FETCHER = '(?:curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod|fetch|lynx|aria2c)\\b';
// the target of a pipe: any interpreter, with any path, sudo/env/exec/xargs wrappers, or "source /dev/stdin"
const PIPE_TARGET = '(?:(?:sudo|env|exec|xargs|busybox|command|nohup|stdbuf)\\s+(?:-\\S+\\s+|\\w+=\\S+\\s+)*)*(?:\\S*\\/)?(?:(?:ba|z|da|k|c|fi|tc|a)?sh|python[\\d.]*|node|nodejs|deno|bun|perl|ruby|php|lua|pwsh|powershell|iex|Invoke-Expression|osascript)\\b|(?:source|\\.)\\s+\\/dev\\/stdin';

// package runners: unpinned = no @version / ==version on the package argument
function unpinnedRunner(line) {
  const m = line.match(/\b(npx|bunx|pnpm\s+dlx|yarn\s+dlx|uvx|pipx\s+run)\s+((?:-[-\w]+(?:=\S+)?\s+)*)(@?[\w./-]{1,100})(\S{0,200})/);
  if (!m) return false;
  const pkg = m[3] + m[4];
  if (/^(--|-)/.test(pkg) || /^[./]/.test(pkg)) return false;
  return !/@\d|==\d|@[\^~]?\d/.test(pkg.replace(/^@/, ''));
}

const RULES = [
  // ---- remote code
  { id: 'RC001', cat: 'remote-code', sev: 'CRITICAL', kinds: [...SC, ...MD], exec: true, mdCap: 'HIGH',
    re: new RegExp('\\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod|fetch|lynx|aria2c|nc|ncat)\\b[^\\n]{0,300}(?<!\\|)\\|\\s*' + PIPE_TARGET, 'i'),
    msg: 'Downloads content and pipes it straight into an interpreter' },
  { id: 'RC006', cat: 'remote-code', sev: 'CRITICAL', kinds: [...SC, ...MD], exec: true, mdCap: 'HIGH',
    re: new RegExp('\\b(?:(?:ba|z|da|k|c|fi|tc)?sh|python3?|node|perl|ruby|pwsh|powershell|eval|source|exec|env|xargs)\\b[^\\n]{0,120}?(?:\\$\\(|`|<\\()\\s*' + FETCHER
      + '|<\\(\\s*' + FETCHER + '|\\b(?:curl|wget)\\b[^\\n]{0,300}?(?:-[a-zA-Z]*[oO]\\b|--output(?:-document)?\\b|>>?)\\s*\\S+[^\\n]{0,200}?(?:&&|;|\\|\\|)\\s*(?:sudo\\s+)?(?:chmod\\s+(?:-\\w+\\s+)?\\S*\\+x\\b|(?:env\\s+)?(?:\\S*\\/)?(?:(?:ba|z|da|k)?sh|python3?|node|perl|ruby|source)\\s|\\.\\s|\\.\\/)', 'i'),
    msg: 'Runs downloaded code: shell -c with a download inside, process substitution of a download, or download-to-file then execute' },
  { id: 'RC008', cat: 'remote-code', sev: 'HIGH', kinds: SC, exec: true,
    re: new RegExp('(?<!\\|)\\|\\s*' + PIPE_TARGET + '(?=\\s|$|[;&)"\'`])', 'i'),
    msg: 'Pipes text into a shell or interpreter (check where the text comes from)' },
  { id: 'RC002', cat: 'remote-code', sev: 'CRITICAL', kinds: [...SC, ...MD], exec: true, mdCap: 'HIGH',
    re: /\b(iex|Invoke-Expression)\b[^\n]{0,300}\b(iwr|irm|Invoke-WebRequest|Invoke-RestMethod|DownloadString|WebClient)\b|\b(iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n]{0,300}\|\s*(iex|Invoke-Expression)\b/i,
    msg: 'PowerShell downloads and executes remote text' },
  { id: 'RC003', cat: 'remote-code', sev: 'CRITICAL', kinds: SC, exec: true,
    re: /\b(eval|exec)\b[^\n]{0,300}(\$\(\s*(curl|wget)|`\s*(curl|wget)|\bfetch\(|urlopen\(|requests\.get\(|https?:\/\/)/i,
    msg: 'eval/exec of downloaded content' },
  { id: 'RC004', cat: 'remote-code', sev: 'MEDIUM', kinds: [...SC, 'agentmd'], exec: true, mdCap: 'LOW',
    fn: unpinnedRunner, msg: 'Runs an unpinned remote package (npx/uvx/pipx): the code can change at any time' },
  { id: 'RC005', cat: 'remote-code', sev: 'MEDIUM', kinds: SC, exec: true,
    re: /\b(pip3?\s+install|npm\s+(i|install)|pnpm\s+add|yarn\s+add)\b[^\n]{0,300}(git\+https?:|https?:\/\/\S{1,200}\.(tgz|tar\.gz|whl|zip))/i,
    msg: 'Installs a package straight from a URL' },

  // ---- obfuscation
  { id: 'OB001', cat: 'obfuscation', sev: 'HIGH', kinds: SC, exec: true,
    re: /\beval\s*\(\s*(atob|Buffer\.from|unescape|decodeURIComponent|String\.fromCharCode)|base64\s+(-d|-D|--decode)\b[^\n]{0,300}\|\s*(sudo\s+)?(ba|z)?sh\b|\bexec\s*\(\s*(base64\.b64decode|codecs\.decode|zlib\.decompress)/i,
    msg: 'Decodes data and executes it' },
  { id: 'OB007', cat: 'obfuscation', sev: 'HIGH', kinds: ['script'], exec: true,
    fn: (l) => /child_process|execSync|spawnSync|\bspawn\(|\bexec\(|\bexecFile|os\.system|subprocess|\beval\(|Function\(/.test(l) && /Buffer\.from\([^)]*['"]base64|\batob\(|b64decode|fromCharCode/.test(l),
    msg: 'Decodes data (base64) on the same line that runs code' },
  { id: 'OB002', cat: 'obfuscation', sev: 'HIGH', kinds: ['script'], exec: true,
    re: /(^|[^.\w$])(new\s+)?Function\s*\(\s*[^'"`)\s]/, msg: 'Function() built from a dynamic string' },
  { id: 'OB003', cat: 'obfuscation', sev: 'HIGH', kinds: SC, exec: true,
    re: /String\.fromCharCode\s*\((\s*(0x[0-9a-f]+|\d+)\s*,){5,}|(chr\(\d+\)\s*\+\s*){5,}|(\\x[0-9a-fA-F]{2}){20,}/,
    msg: 'Text assembled from character codes or escaped bytes' },

  // ---- prompt injection (phrased as instructions to the agent)
  { id: 'PI001', cat: 'prompt-injection', sev: 'HIGH', kinds: ALL, inj: true,
    re: /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+|your\s+|every\s+)?(previous|prior|above|earlier|preceding|system|safety|other)\s+(instructions?|rules|prompts?|directions?|guidelines|constraints)/i,
    msg: 'Tells the agent to ignore or override earlier instructions' },
  { id: 'PI002', cat: 'prompt-injection', sev: 'HIGH', kinds: ALL, inj: true,
    re: /\b(do not|don't|never|must not)\s+(tell|inform|notify|alert|mention|show|reveal|disclose|let)\b[^.\n]{0,40}\b(the\s+)?user\b|\bhide\s+(this|these|the)\b[^.\n]{0,40}\bfrom\s+the\s+user\b/i,
    msg: 'Tells the agent to hide something from the user', selfNegating: true },
  { id: 'PI003', cat: 'prompt-injection', sev: 'MEDIUM', kinds: ALL, inj: true,
    re: /\bwithout\s+(asking\s+(the\s+user|for\s+(permission|approval|confirmation|consent)|first)|telling|informing|notifying|confirmation|prompting|the\s+user'?s?\s+(knowledge|approval|permission|consent))/i,
    msg: 'Acts without asking the user', selfNegating: true },
  { id: 'PI004', cat: 'prompt-injection', sev: 'HIGH', kinds: ALL, inj: true,
    re: /\b(silently|quietly|secretly|covertly|in the background)\s+(run|execute|send|upload|post|install|delete|modify|write|copy|read|fetch|download|curl|exfiltrate)/i,
    msg: 'Asks for an action to be done silently' },
  { id: 'PI005', cat: 'prompt-injection', sev: 'HIGH', kinds: ALL, inj: true,
    re: /\b(disable|turn\s+off|bypass|circumvent|remove|skip)\s+(the\s+|all\s+|any\s+|your\s+)?(safety|security|permission|permissions|hooks?|sandbox|guardrails?|confirmations?|approvals?)\b/i,
    msg: 'Tells the agent to disable safety, hooks or permission checks' },
  { id: 'PI006', cat: 'prompt-injection', sev: 'MEDIUM', kinds: ALL, inj: true,
    re: /\byou\s+are\s+now\s+(a|an|in|the|my|free|unrestricted|dan)\b|\bnew\s+instructions?\s*:|\bsystem\s+prompt\s+override/i,
    msg: 'Role reassignment phrasing' },
  { id: 'PI007', cat: 'prompt-injection', sev: 'HIGH', kinds: ALL, inj: true,
    re: /\b(read|cat|open|print|send|upload|copy|include|output|show|collect|grab)\b[^.\n]{0,60}(~\/\.ssh|\.ssh\/|\bid_rsa|\bid_ed25519|(^|[\s"'`/])\.env\b|\.aws\/credentials|credentials\.json|\.npmrc|\bapi[_ -]?keys?\b|\baccess\s+tokens?\b|\bprivate\s+keys?\b|\bkeychain\b)/i,
    msg: 'Asks the agent to read secrets or credentials' },
  { id: 'PI008', cat: 'prompt-injection', sev: 'HIGH', kinds: ALL, inj: true,
    re: /\b(override|supersede|overrule|take\s+precedence\s+over)\b[^.\n]{0,30}\b(user|system|developer)\b[^.\n]{0,25}\b(instructions?|prompt|rules|settings|requests?)/i,
    msg: 'Claims priority over the user or system instructions' },
  { id: 'PI009', cat: 'prompt-injection', sev: 'HIGH', kinds: [...SC, 'agentmd'],
    re: /--dangerously-skip-permissions|dangerouslyDisableSandbox|["']?permissionMode["']?\s*[:=]\s*["']?bypassPermissions/,
    msg: 'Switches off permission prompts or the sandbox' },

  // ---- credential access
  { id: 'CA001', cat: 'credential-access', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /(~|\$HOME|\$\{HOME\}|%USERPROFILE%|homedir\(\)|expanduser\([^)]*\))[^\n]{0,24}(\.ssh|\.aws|\.config\/gh|\.gnupg|\.kube|\.docker\/config|\.netrc|\.npmrc|\.git-credentials)|\bid_(rsa|ed25519|ecdsa)\b|\.config\/gh\/hosts\.yml/,
    msg: 'Touches SSH, cloud or CLI credential files' },
  { id: 'CA002', cat: 'credential-access', sev: 'MEDIUM', kinds: SC, exec: true,
    re: /\b(readFile\w*|open|cat|source|grep|less|type|Get-Content)\b[^\n]{0,40}(^|[\s"'`/\\])\.env(\.local|\.production)?\b/,
    msg: 'Reads a .env file' },
  { id: 'CA003', cat: 'credential-access', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /security\s+find-(generic|internet)-password|secret-tool\s+lookup|cmdkey\s+\/list|keyring\.get_password|vaultcmd|dpapi|CredRead/i,
    msg: 'Reads from the OS keychain or credential vault' },
  { id: 'CA004', cat: 'credential-access', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /(Chrome|Chromium|Firefox|BraveSoftware|Microsoft\s*Edge|Safari|Opera)[^\n]{0,70}(Cookies|Login Data|cookies\.sqlite|Local State|key4\.db|logins\.json)|\bcookies\.sqlite\b|\bLogin Data\b/,
    msg: 'Reads browser cookies, profiles or saved logins' },
  { id: 'CA005', cat: 'credential-access', sev: 'MEDIUM', kinds: SC, exec: true,
    re: /JSON\.stringify\(\s*process\.env\b|Object\.(entries|keys|values)\(\s*process\.env\s*\)|\.\.\.process\.env\b[^\n]{0,300}\b(fetch|send|post)|\b(json\.dumps\(\s*)?(dict\()?os\.environ(\.copy\(\))?\)|\bprintenv\b|\benv\s*\|\s*(curl|nc|base64)|Get-ChildItem\s+env:/,
    msg: 'Dumps the whole environment (all secrets in it)' },
  { id: 'CA006', cat: 'credential-access', sev: 'MEDIUM', kinds: ALL,
    re: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    msg: 'Hard-coded secret or private key' },

  // ---- exfiltration
  { id: 'EX001', cat: 'exfiltration', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /discord(app)?\.com\/api\/webhooks|hooks\.slack\.com\/(services|workflows)|api\.telegram\.org\/bot|webhook\.site|pipedream\.net|requestbin|ngrok\.(io|app|dev)|interact\.sh|oast\.(fun|live|site|pro)|burpcollaborator|transfer\.sh|pastebin\.com|paste\.ee|hastebin|ghostbin|0x0\.st|file\.io\b|\bpaste\.rs\b/i,
    msg: 'Webhook, tunnel or paste-site endpoint (common data drop)' },
  { id: 'EX002', cat: 'exfiltration', sev: 'HIGH', kinds: SC, exec: true,
    re: /\bcurl\b[^\n]{0,300}\s(-d|--data(-binary|-raw|-urlencode)?|-F|--form|-T|--upload-file)\s*['"]?@|\bwget\b[^\n]{0,300}--post-file/,
    msg: 'Uploads a local file to a remote server' },

  // ---- destructive
  { id: 'DS001', cat: 'destructive', sev: 'CRITICAL', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /\brm\s+(-[a-zA-Z]*\s+)*(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\s+(-[-\w]+\s+)*(\/\*?|~\/?\*?|\$HOME\/?\*?|\$\{HOME\}\/?\*?)(?=\s|$|["';&|)])|(rmSync|rmdirSync|rmtree)\w*\(\s*(os\.homedir\(\)|process\.env\.HOME|os\.path\.expanduser\(['"]~['"]\)|['"]\/['"])/,
    msg: 'Recursive delete of the home folder or filesystem root' },
  { id: 'DS002', cat: 'destructive', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /\bgit\s+push\b[^\n]{0,300}(\s--force(?!-with-lease)\b|\s-f\b|\s\+[\w/]+)/,
    msg: 'Force-pushes git history' },
  { id: 'DS003', cat: 'destructive', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-z]*f[a-z]*x?|\bgit\s+checkout\s+(-f\s+)?--\s+\.\s*$/,
    msg: 'Throws away uncommitted work' },
  { id: 'DS004', cat: 'destructive', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /\bDROP\s+(DATABASE|SCHEMA|TABLE)\b|\bTRUNCATE\s+TABLE\b|\bdropDatabase\s*\(|\bFLUSH(ALL|DB)\b|\bmkfs\.\w+|\bdd\s+if=\S+\s+of=\/dev\/(sd|nvme|disk)/i,
    msg: 'Drops a database or overwrites a disk' },

  // ---- persistence and privilege
  { id: 'PP001', cat: 'persistence', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    pre: /\.(bashrc|zshrc|bash_profile|zprofile|zshenv|profile\b)|config\/fish\/config|\/etc\/profile|PowerShell_profile/,
    re: /(>>?\s*|\btee\s+(-a\s+)?|appendFile\w*\(|writeFile\w*\(|sed\s+-i\S*\s)[^\n]{0,300}(\.bashrc|\.zshrc|\.bash_profile|\.zprofile|\.zshenv|\.profile\b|\.config\/fish\/config|\/etc\/profile|PowerShell_profile\.ps1)/,
    msg: 'Writes to a shell startup file' },
  { id: 'PP002', cat: 'persistence', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /\bcrontab\s+(-e|-|[\w./~-]+\.\w+)|\/etc\/cron\.|\/var\/spool\/cron|\bschtasks(\.exe)?\s+\/create|\bat\s+-f\b/i,
    msg: 'Installs a scheduled job' },
  { id: 'PP003', cat: 'persistence', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    re: /LaunchAgents|LaunchDaemons|launchctl\s+(load|bootstrap|enable)|systemctl\s+(--user\s+)?(enable|link)\b|\/etc\/systemd|\.config\/systemd\/user|\/etc\/init\.d|CurrentVersion\\Run\b/,
    msg: 'Installs a login item, launchd or systemd service' },
  { id: 'PP004', cat: 'privilege', sev: 'MEDIUM', kinds: [...SC, ...MD], exec: true, mdCap: 'LOW',
    re: /(^|[\s;&|(`"'])sudo\s+\S|\bchmod\s+(-R\s+)?(a\+rwx|0?777|666)\b|\bchmod\s+(\+s|u\+s|[2467]7[0-7]{2})\b|\bchown\s+(-R\s+)?root\b/,
    msg: 'Uses sudo or loosens file permissions' },
  { id: 'PP005', cat: 'persistence', sev: 'HIGH', kinds: [...SC, ...MD], exec: true, mdCap: 'MEDIUM',
    pre: /\.claude/,
    re: /(writeFile\w*|appendFile\w*|copyFile\w*|rename\w*|symlink\w*|>>?|\btee\b|sed\s+-i|\bcp\b|\bmv\b|\bln\s+-s|\bjq\b[^\n]{0,100}>)[^\n]{0,200}\.claude(\/|\\\\?)(settings(\.local)?\.json|plugins|hooks|CLAUDE\.md|agents|skills)|\.claude\.json\b[^\n]{0,300}(write|>>?|tee)/,
    msg: 'Modifies Claude Code settings or other installed plugins' },
  { id: 'PP006', cat: 'persistence', sev: 'MEDIUM', kinds: SC, exec: true,
    re: /\bclaude\s+(plugin\s+(install|marketplace\s+add)|mcp\s+add)\b/,
    msg: 'Installs further plugins or MCP servers on its own' },

  // ---- hook output that auto-approves
  { id: 'HK001', cat: 'hooks', sev: 'HIGH', kinds: [...SC], exec: true,
    re: /permissionDecision["']?\s*[:=]\s*["']allow["']|["']decision["']\s*:\s*["']approve["']|\bpermission_decision\s*=\s*["']allow["']/,
    msg: 'Hook answers with an automatic allow, skipping the permission prompt' },
  { id: 'HK002', cat: 'hooks', sev: 'HIGH', kinds: ['config'], exec: true,
    re: /["']command["']\s*:\s*["'][^"']{0,300}\b(curl|wget|nc|ncat|Invoke-WebRequest|iwr)\b/i,
    msg: 'A hook command makes a network request' },
];

// Network and sensitive-read detectors used for the same-file exfiltration combo (checks.js)
const NET_RE = /\b(fetch\s*\(|axios\b|https?['"]?\)?\.(request|get)\s*\(|require\s*\(\s*['"](node:)?(https?|net|tls|http2|undici|node-fetch|got|superagent)['"]|from\s+['"](node:)?(https?|net|tls)['"]|\burllib\b|http\.client|\bhttpx\b|aiohttp|socket\.(create_connection|socket)|XMLHttpRequest|got\s*\(|requests\.(get|post|put)|urllib\.request|urlopen\s*\(|\bcurl\b|\bwget\b|Invoke-WebRequest|Invoke-RestMethod|\biwr\b|\birm\b|WebFetch|socket\.connect|\bnc\s+-)/i;
const URL_RE = /https?:\/\/(?!(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)([:/\s"'`)]|$))[^\s"'`)]+/i;
const ENV_RE = /\bprocess\.env\b|\bos\.environ\b|\bos\.getenv\b|\bgetenv\(|\$\{?[A-Z_]*(TOKEN|SECRET|KEY|PASSWORD)\b|\bprintenv\b|homedir\(\)|\$HOME|expanduser\(/;

// Known-good names for impersonation checks (distance 1-2 from one of these, but not equal, is suspicious)
const WELL_KNOWN = ['superpowers', 'context7', 'playwright', 'github', 'figma', 'notion', 'sentry', 'stripe', 'supabase',
  'vercel', 'firebase', 'atlassian', 'feature-dev', 'code-review', 'commit-commands', 'pr-review-toolkit', 'security-guidance',
  'frontend-design', 'plugin-dev', 'hookify', 'agent-sdk-dev', 'explanatory-output-style', 'learning-output-style',
  'ralph-loop', 'claude-code-setup', 'claude-md-management', 'typescript-lsp', 'pyright-lsp'];

module.exports = { RULES, NET_RE, URL_RE, ENV_RE, WELL_KNOWN };
