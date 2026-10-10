// Permission system: allow / ask / deny with glob patterns, last-match-wins.

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function expandHome(p) {
  if (p.startsWith('~') || p.startsWith('$HOME')) {
    return p.replace(/^~(\/|$)/, process.env.HOME + '$1').replace(/^\$HOME(\/|$)/, process.env.HOME + '$1');
  }
  return p;
}

function matchPattern(pattern, text) {
  const pat = expandHome(pattern);
  try {
    return globToRegex(pat).test(text);
  } catch {
    return false;
  }
}

/**
 * Resolve a permission for a tool.
 * @param {string} toolName - tool name (e.g. "bash", "edit", "write")
 * @param {object|string} rule - permission config for this tool (string "allow"/"ask"/"deny" or object of patterns)
 * @param {string} target - the string to match against (command, path, etc)
 * @returns {"allow"|"ask"|"deny"}
 */
export function resolvePermission(toolName, rule, target) {
  if (!rule) return 'allow';

  if (typeof rule === 'string') {
    if (['allow', 'ask', 'deny'].includes(rule)) return rule;
    return 'allow';
  }

  if (typeof rule === 'object') {
    // Last matching rule wins
    let result = null;
    for (const [pattern, action] of Object.entries(rule)) {
      if (pattern === '*') {
        result = action;
        continue;
      }
      if (matchPattern(pattern, target)) {
        result = action;
      }
    }
    if (result && ['allow', 'ask', 'deny'].includes(result)) return result;
    // If no match at all, fall through
    if (rule['*'] && ['allow', 'ask', 'deny'].includes(rule['*'])) return rule['*'];
    return 'allow';
  }

  return 'allow';
}

/**
 * Check permission for a tool call against config + agent overrides.
 * @returns {"allow"|"ask"|"deny"}
 */
export function checkPermission(toolName, args, config, agentPermission) {
  // Determine the target string for pattern matching
  let target = '';
  if (toolName === 'bash') target = args?.command ?? '';
  else if (toolName === 'read') target = args?.path ?? '';
  else if (toolName === 'edit' || toolName === 'write' || toolName === 'apply_patch') target = args?.path ?? '';
  else if (toolName === 'glob') target = args?.pattern ?? '';
  else if (toolName === 'list') target = args?.path ?? '.';
  else if (toolName === 'grep') target = args?.pattern ?? '';
  else if (toolName === 'webfetch') target = args?.url ?? '';
  else if (toolName === 'task') target = args?.agent ?? '';
  else if (toolName === 'skill') target = args?.name ?? '';
  else if (toolName === 'external_directory') target = args?.path ?? '';

  // Check if path is outside workspace → external_directory permission
  if (['read', 'edit', 'write', 'apply_patch', 'glob', 'grep'].includes(toolName) && target) {
    const ext = config?.permission?.external_directory;
    if (ext) {
      const abs = target;
      if (abs.startsWith('/') || abs.match(/^[A-Za-z]:/)) {
        const verdict = resolvePermission('external_directory', ext, abs);
        if (verdict === 'deny') return 'deny';
      }
    }
  }

  // Doom loop guard defaults to ask (like OpenCode)
  if (toolName === 'doom_loop') {
    if (!config?.permission?.doom_loop) return 'ask';
    return resolvePermission('doom_loop', config.permission.doom_loop, '');
  }

  // list is gated by the glob permission
  if (toolName === 'list') {
    const globRule = agentPermission?.glob ?? config?.permission?.glob;
    if (globRule !== undefined) return resolvePermission('glob', globRule, target);
    return 'allow';
  }

  // Agent permissions override global (last-wins)
  const globalRule = config?.permission?.[toolName];
  const agentRule = agentPermission?.[toolName];
  const rule = agentRule !== undefined ? agentRule : globalRule;

  // Special: edit tool covers write + apply_patch
  if ((toolName === 'write' || toolName === 'apply_patch') && !rule && config?.permission?.edit) {
    return resolvePermission('edit', config.permission.edit, target);
  }
  if ((toolName === 'write' || toolName === 'apply_patch') && !rule && agentPermission?.edit) {
    return resolvePermission('edit', agentPermission.edit, target);
  }

  // Read default: allow except .env files
  if (toolName === 'read' && !rule) {
    if (target && (target.endsWith('.env') || target.match(/\.env\.[^.]+$/)) && !target.endsWith('.env.example')) {
      return 'deny';
    }
    return 'allow';
  }

  if (!rule) return 'allow';

  return resolvePermission(toolName, rule, target);
}

/**
 * Get patterns that "always" would approve for a given tool call.
 */
export function alwaysPatterns(toolName, args) {
  if (toolName === 'bash') {
    const cmd = args?.command ?? '';
    const firstWord = cmd.split(/\s+/)[0];
    return [`${firstWord} *`];
  }
  if (toolName === 'edit' || toolName === 'write' || toolName === 'apply_patch') {
    const p = args?.path ?? '';
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '*';
    return [`${dir}/*`];
  }
  return [];
}

/**
 * Plan mode: deny all mutating tools.
 */
export function planModeDeny(toolName) {
  return ['write', 'edit', 'apply_patch', 'bash'].includes(toolName);
}
