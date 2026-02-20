#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const stateDir = path.join(repoRoot, 'state');
const profilesPath = path.join(repoRoot, 'profiles', 'profiles.json');
const adaptersPath = path.join(repoRoot, 'scripts', 'adapters', 'catalog.json');
const activeProfilePath = path.join(stateDir, 'active-profile.txt');
const vmManifestPath = path.join(repoRoot, 'runtime', 'linux', 'vm-manifest.json');
const vmStateDir = path.join(repoRoot, 'state', 'vm');
const vmSshPortPath = path.join(vmStateDir, 'ssh-port.txt');
const settingsPath = path.join(stateDir, 'settings.json');
const authStateRoot = path.join(stateDir, 'auth');
const authModeValues = new Set(['oauth', 'api']);
const runModeValues = new Set(['linux-portable', 'host-native', 'linux-wsl']);
const windowsDefaultModeValues = new Set(['linux-portable', 'host-native']);

function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'doctor':
      commandDoctor();
      return;
    case 'list-tools':
      commandListTools();
      return;
    case 'profile':
      commandProfile(rest);
      return;
    case 'setup':
      commandSetup(rest);
      return;
    case 'auth':
      commandAuth(rest);
      return;
    case 'runtime':
      commandRuntime(rest);
      return;
    case 'run':
      commandRun(rest);
      return;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      return;
    default:
      fail(`Unknown command: ${command}`);
  }
}

function printHelp() {
  const adapters = loadJsonSafe(adaptersPath, 'adapter catalog');
  const toolNames = Object.keys(adapters);
  console.log('Portable Coder Launcher (pcoder)');
  console.log('');
  console.log('Usage:');
  console.log('  pcoder doctor');
  console.log('  pcoder list-tools');
  console.log('  pcoder profile use <name>');
  console.log('  pcoder profile show');
  console.log('  pcoder setup [--init] [--codex-auth <oauth|api>] [--claude-auth <oauth|api>] [--windows-mode <linux-portable|host-native>] [--sync-back <true|false>] [--show]');
  console.log('  pcoder auth status');
  console.log('  pcoder auth login <codex|claude> [--mode <linux-portable|host-native>]');
  console.log('  pcoder auth logout <codex|claude> [--mode <linux-portable|host-native>]');
  console.log('  pcoder runtime probe');
  console.log('  pcoder runtime bootstrap [--force]');
  console.log('  pcoder run <tool> [--mode <linux-portable|host-native>] [--profile <name>] [--project <path>] [--no-sync-back] [-- <tool args...>]');
  console.log('');
  console.log(`Tools: ${toolNames.join(', ')}`);
}

function commandDoctor() {
  const checks = [];
  const requiredDirs = ['runtime', 'apps', 'profiles', 'state', 'scripts'];
  for (const rel of requiredDirs) {
    const abs = path.join(repoRoot, rel);
    checks.push({
      label: `dir:${rel}`,
      ok: fs.existsSync(abs) && fs.statSync(abs).isDirectory(),
      detail: abs
    });
  }

  const profiles = loadJsonSafe(profilesPath, 'profiles manifest');
  const adapters = loadJsonSafe(adaptersPath, 'adapter catalog');
  const settings = loadSettings();
  checks.push({
    label: 'settings:file',
    ok: settingsFileExists(),
    detail: settingsFileExists()
      ? path.relative(repoRoot, settingsPath)
      : "missing (run 'pcoder setup --init')"
  });

  let activeProfile = readActiveProfile();
  if (!activeProfile) {
    activeProfile = profiles.default_profile || '';
  }

  checks.push({
    label: 'active-profile',
    ok: Boolean(activeProfile),
    detail: activeProfile || '(not set)'
  });

  for (const [name, profile] of Object.entries(profiles.profiles || {})) {
    const envResult = loadProfileEnv(profile, false);
    const effectiveEnv = { ...process.env, ...envResult.env };
    const req = validateProfileRequirements(profile, effectiveEnv);
    const toolForProfile = findToolByDefaultProfile(name, adapters);
    const authMode = toolForProfile ? getAuthModeForTool(toolForProfile, settings) : 'api';
    let shouldEnforce = false;
    let skippedReason = 'optional profile skipped';
    if (toolForProfile) {
      const selectedProfile = resolveProfileName(null, adapters[toolForProfile], profiles);
      shouldEnforce = selectedProfile === name && authMode === 'api';
      if (selectedProfile !== name) {
        skippedReason = `profile not selected for ${toolForProfile} (selected: ${selectedProfile})`;
      } else if (authMode !== 'api') {
        skippedReason = `selected for ${toolForProfile} in oauth mode`;
      }
    } else {
      const isActive = name === activeProfile;
      shouldEnforce = isActive;
      skippedReason = isActive ? 'active profile (no tool mapping)' : 'optional profile skipped';
    }

    checks.push({
      label: `profile:${name}:env-files`,
      ok: shouldEnforce ? envResult.missingFiles.length === 0 : true,
      detail: shouldEnforce
        ? (envResult.missingFiles.length === 0 ? 'ok' : `missing ${envResult.missingFiles.join(', ')}`)
        : (envResult.missingFiles.length > 0
          ? `optional profile not configured (${envResult.missingFiles.join(', ')})`
          : 'optional profile uses external env injection')
    });
    checks.push({
      label: `profile:${name}:required-env`,
      ok: shouldEnforce ? req.ok : true,
      detail: shouldEnforce ? req.message : skippedReason
    });
  }

  for (const [tool, adapter] of Object.entries(adapters)) {
    const authMode = getAuthModeForTool(tool, settings);
    if (process.platform === 'win32') {
      const vmRunner = resolveVmToolRunner(tool, adapter, process.env);
      checks.push({
        label: `tool:${tool}:runner`,
        ok: true,
        detail: `vm guest runner '${vmRunner}' (auth=${authMode}, host binary optional)`
      });
      continue;
    }

    const probeEnv = process.env;
    const runner = resolveRunner(adapter, probeEnv);
    checks.push({
      label: `tool:${tool}:runner`,
      ok: Boolean(runner),
      detail: runner ? `${runner} (auth=${authMode})` : `not found (${adapter.candidate_commands.join(', ')})`
    });
  }

  let failed = 0;
  for (const check of checks) {
    if (check.ok) {
      console.log(`[ok]   ${check.label} -> ${check.detail}`);
    } else {
      failed += 1;
      console.log(`[fail] ${check.label} -> ${check.detail}`);
    }
  }

  if (failed > 0) {
    process.exitCode = 2;
    console.log(`\nDoctor completed with ${failed} failed check(s).`);
    console.log("Run 'pcoder setup --init' for first-time onboarding, then inject required env vars and ensure CLI runners are available.");
    return;
  }

  console.log('\nDoctor completed: all checks passed.');
}

function commandListTools() {
  const adapters = loadJsonSafe(adaptersPath, 'adapter catalog');
  console.log('Available tools:\n');
  for (const [name, adapter] of Object.entries(adapters)) {
    console.log(`- ${name}`);
    console.log(`  ${adapter.display_name}`);
    console.log(`  default profile: ${adapter.default_profile}`);
    console.log(`  command env: ${adapter.command_env}`);
    console.log(`  candidates: ${adapter.candidate_commands.join(', ')}`);
  }
}

function commandProfile(args) {
  const action = args[0];
  const profiles = loadJsonSafe(profilesPath, 'profiles manifest');
  if (action === 'show' || !action) {
    const active = readActiveProfile() || profiles.default_profile || '(none)';
    console.log(active);
    return;
  }

  if (action !== 'use') {
    fail(`Unknown profile action: ${action}`);
  }

  const name = args[1];
  if (!name) {
    fail('Usage: pcoder profile use <name>');
  }

  if (!profiles.profiles[name]) {
    const known = Object.keys(profiles.profiles).join(', ');
    fail(`Unknown profile '${name}'. Known profiles: ${known}`);
  }

  ensureDir(stateDir);
  fs.writeFileSync(activeProfilePath, `${name}\n`, 'utf8');
  console.log(`Active profile set to '${name}'.`);
}

function commandSetup(args) {
  const parsed = parseSetupArgs(args);
  const hadSettings = settingsFileExists();
  const settings = parsed.init ? defaultSettings() : loadSettings();
  let changed = parsed.init;

  if (parsed.codexAuth) {
    changed = changed || settings.auth.codex !== parsed.codexAuth;
    settings.auth.codex = parsed.codexAuth;
  }
  if (parsed.claudeAuth) {
    changed = changed || settings.auth.claude !== parsed.claudeAuth;
    settings.auth.claude = parsed.claudeAuth;
  }
  if (parsed.windowsMode) {
    changed = changed || settings.runtime.windows_default_mode !== parsed.windowsMode;
    settings.runtime.windows_default_mode = parsed.windowsMode;
  }
  if (typeof parsed.syncBack === 'boolean') {
    changed = changed || settings.runtime.sync_back_default !== parsed.syncBack;
    settings.runtime.sync_back_default = parsed.syncBack;
  }

  const shouldSave = changed || parsed.persist;
  if (shouldSave) {
    saveSettings(settings);
  }

  if (shouldSave) {
    console.log('Setup saved to state/settings.json');
    console.log('');
  } else if (!hadSettings) {
    console.log("Settings are not initialized yet. Run 'pcoder setup --init' to create state/settings.json.");
    console.log('');
  }
  printSettings(settings, hadSettings || shouldSave);
}

function commandAuth(args) {
  const action = args[0];
  const hasSettings = settingsFileExists();
  const settings = hasSettings ? loadSettings() : defaultSettings();
  const adapters = loadJsonSafe(adaptersPath, 'adapter catalog');

  if (!action || action === 'status') {
    printAuthStatus(settings, hasSettings);
    return;
  }

  if (action !== 'login' && action !== 'logout') {
    fail('Usage: pcoder auth <status|login|logout> [tool] [--mode <linux-portable|host-native>]');
  }
  if (!hasSettings) {
    fail("Settings are not initialized. Run 'pcoder setup --init' before auth login/logout.");
  }

  const tool = args[1];
  if (!tool || !adapters[tool]) {
    fail(`Unknown or missing tool. Supported: ${Object.keys(adapters).join(', ')}`);
  }

  const parsed = parseAuthArgs(args.slice(2));
  const mode = resolveRunMode(parsed.mode, settings);
  const authMode = getAuthModeForTool(tool, settings);

  if (action === 'login' && authMode === 'api') {
    console.log(`[warn] ${tool} auth mode is 'api'; OAuth login is optional.`);
  }
  const authCommandSettings = authMode === 'oauth'
    ? settings
    : {
      ...settings,
      auth: {
        ...settings.auth,
        [tool]: 'oauth'
      }
    };
  const authExecutionMode = 'oauth';

  if (mode === 'linux-portable') {
    runInLinuxPortableVm({
      tool,
      adapter: adapters[tool],
      projectPath: repoRoot,
      mergedEnv: applyPortableHostAuthEnv(tool, { ...process.env }, authCommandSettings),
      toolArgs: [action],
      noSyncBack: true,
      skipProjectSync: true,
      authMode: authExecutionMode,
      settings
    });
    return;
  }

  if (mode === 'linux-wsl') {
    fail('linux-wsl mode is not implemented yet. Use --mode linux-portable or --mode host-native.');
  }

  if (mode !== 'host-native') {
    fail(`Unsupported auth mode target '${mode}'.`);
  }

  const adapter = adapters[tool];
  const env = applyPortableHostAuthEnv(tool, { ...process.env }, authCommandSettings);
  const runner = resolveRunner(adapter, env);
  if (!runner) {
    fail(`No executable found for ${tool}. Install it or set ${adapter.command_env}.`);
  }

  const result = cp.spawnSync(runner, [action], {
    cwd: repoRoot,
    stdio: 'inherit',
    env
  });
  if (result.error) {
    fail(`Failed to run ${tool} ${action}: ${result.error.message}`);
  }
  process.exitCode = typeof result.status === 'number' ? result.status : 1;
}

function commandRuntime(args) {
  const action = args[0];
  if (!action || action === 'probe') {
    commandRuntimeProbe();
    return;
  }
  if (action === 'bootstrap' || action === 'install') {
    commandRuntimeBootstrap(args.slice(1));
    return;
  }
  fail('Usage: pcoder runtime <probe|bootstrap>');
}

function commandRuntimeProbe() {
  const probes = [
    { key: 'bundled-qemu', cmd: path.join(repoRoot, 'runtime', 'qemu', 'qemu-system-x86_64.exe') },
    { key: 'wsl', cmd: 'wsl' },
    { key: 'proot', cmd: 'proot' },
    { key: 'docker', cmd: 'docker' },
    { key: 'podman', cmd: 'podman' },
    { key: 'limactl', cmd: 'limactl' },
    { key: 'qemu-system-x86_64', cmd: 'qemu-system-x86_64' }
  ];

  console.log(`host_platform=${process.platform}`);
  for (const probe of probes) {
    console.log(`${probe.key}=${commandOrPathExists(probe.cmd) ? 'yes' : 'no'}`);
  }

  const recommendation = recommendRuntimeBackend(process.platform, probes);
  console.log(`recommended_backend=${recommendation}`);
  if (process.platform === 'win32') {
    console.log('vm_accel_policy=try_whpx_then_fallback_tcg');
  }
}

function commandRuntimeBootstrap(args) {
  if (process.platform !== 'win32') {
    fail('runtime bootstrap is currently implemented for Windows hosts only.');
  }

  const supported = new Set(['--force']);
  for (const arg of args) {
    if (!supported.has(arg)) {
      fail(`Unknown runtime bootstrap flag: ${arg}`);
    }
  }

  const bootstrapScript = path.join(repoRoot, 'scripts', 'runtime', 'windows', 'bootstrap-runtime.cmd');
  if (!fs.existsSync(bootstrapScript)) {
    fail(`Missing runtime bootstrap script: ${bootstrapScript}`);
  }

  const cmdArgs = ['/c', bootstrapScript];
  if (args.includes('--force')) {
    cmdArgs.push('--force');
  }

  const result = cp.spawnSync('cmd.exe', cmdArgs, {
    cwd: repoRoot,
    stdio: 'inherit'
  });
  if (result.error) {
    fail(`Failed to execute runtime bootstrap script: ${result.error.message}`);
  }
  process.exitCode = typeof result.status === 'number' ? result.status : 1;
}

function recommendRuntimeBackend(platform, probes) {
  const available = new Set(probes.filter((p) => commandOrPathExists(p.cmd)).map((p) => p.key));
  if (platform === 'win32') {
    if (available.has('bundled-qemu') || available.has('qemu-system-x86_64')) {
      return 'bundled-vm-qemu-auto-accel-fallback';
    }
    if (available.has('wsl')) {
      return 'wsl-optional-no-bundled-engine';
    }
    return 'bundled-vm-qemu-missing';
  }

  if (platform === 'darwin') {
    if (available.has('limactl')) {
      return 'lima-vm';
    }
    if (available.has('docker')) {
      return 'docker-vm';
    }
    return 'host-native-fallback';
  }

  if (platform === 'linux') {
    if (available.has('proot')) {
      return 'proot-userspace';
    }
    if (available.has('podman')) {
      return 'podman-container';
    }
    if (available.has('docker')) {
      return 'docker-container';
    }
    return 'host-native-fallback';
  }

  return 'host-native-fallback';
}

function commandRun(args) {
  const tool = args[0];
  if (!tool) {
    fail('Usage: pcoder run <tool> [--mode <linux-portable|host-native>] [--profile <name>] [--project <path>] [--no-sync-back] [-- <tool args...>]');
  }
  if (!settingsFileExists()) {
    fail("Settings are not initialized. Run 'pcoder setup --init' before running tools.");
  }

  const parsed = parseRunArgs(args.slice(1));
  const profiles = loadJsonSafe(profilesPath, 'profiles manifest');
  const adapters = loadJsonSafe(adaptersPath, 'adapter catalog');
  const settings = loadSettings();
  const adapter = adapters[tool];

  if (!adapter) {
    fail(`Unknown tool '${tool}'. Run 'pcoder list-tools'.`);
  }

  const profileName = resolveProfileName(parsed.profile, adapter, profiles);
  const profile = profiles.profiles[profileName];
  if (!profile) {
    fail(`Profile '${profileName}' is not defined in profiles/profiles.json`);
  }

  const loaded = loadProfileEnv(profile, true);
  const mergedEnv = { ...process.env, ...loaded.env };
  const authMode = getAuthModeForTool(tool, settings);
  applyPortableHostAuthEnv(tool, mergedEnv, settings);
  applyToolCompatibilityEnv(tool, mergedEnv);

  if (authMode === 'api') {
    const req = validateProfileRequirements(profile, mergedEnv);
    if (!req.ok) {
      fail(`Profile '${profileName}' is missing required env values: ${req.message}`);
    }
  }

  const projectPath = parsed.project ? path.resolve(parsed.project) : process.cwd();
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    fail(`Project path does not exist or is not a directory: ${projectPath}`);
  }

  const mode = resolveRunMode(parsed.mode, settings);
  const noSyncBack = parsed.noSyncBack === true
    ? true
    : !Boolean(settings.runtime.sync_back_default);
  if (mode === 'linux-portable') {
    runInLinuxPortableVm({
      tool,
      adapter,
      projectPath,
      mergedEnv,
      toolArgs: parsed.toolArgs,
      noSyncBack,
      skipProjectSync: false,
      authMode,
      settings
    });
    return;
  }

  if (mode === 'linux-wsl') {
    fail('linux-wsl mode is not implemented yet. Use --mode linux-portable or --mode host-native.');
  }

  if (mode !== 'host-native') {
    fail(`Unsupported run mode '${mode}'. Supported modes: linux-portable, host-native`);
  }

  const runner = resolveRunner(adapter, mergedEnv);
  if (!runner) {
    fail(`No executable found for tool '${tool}'. Set ${adapter.command_env} or install one of: ${adapter.candidate_commands.join(', ')}`);
  }

  const result = cp.spawnSync(runner, parsed.toolArgs, {
    cwd: projectPath,
    stdio: 'inherit',
    env: mergedEnv
  });

  if (result.error) {
    fail(`Failed to launch '${runner}': ${result.error.message}`);
  }

  process.exitCode = typeof result.status === 'number' ? result.status : 1;
}

function parseRunArgs(args) {
  const parsed = { profile: null, project: null, mode: null, noSyncBack: false, toolArgs: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') {
      parsed.toolArgs = args.slice(i + 1);
      return parsed;
    }
    if (arg === '--profile') {
      parsed.profile = args[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--project') {
      parsed.project = args[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--mode') {
      parsed.mode = args[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--no-sync-back') {
      parsed.noSyncBack = true;
      continue;
    }
    parsed.toolArgs.push(arg);
  }
  return parsed;
}

function parseSetupArgs(args) {
  const parsed = {
    init: false,
    codexAuth: null,
    claudeAuth: null,
    windowsMode: null,
    syncBack: undefined,
    persist: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--init') {
      parsed.init = true;
      parsed.persist = true;
      continue;
    }
    if (arg === '--show') {
      continue;
    }
    if (arg === '--codex-auth') {
      parsed.codexAuth = normalizeAuthModeValue(args[i + 1], '--codex-auth');
      parsed.persist = true;
      i += 1;
      continue;
    }
    if (arg === '--claude-auth') {
      parsed.claudeAuth = normalizeAuthModeValue(args[i + 1], '--claude-auth');
      parsed.persist = true;
      i += 1;
      continue;
    }
    if (arg === '--windows-mode') {
      parsed.windowsMode = normalizeWindowsModeValue(args[i + 1], '--windows-mode');
      parsed.persist = true;
      i += 1;
      continue;
    }
    if (arg === '--sync-back') {
      parsed.syncBack = parseBooleanFlagValue(args[i + 1], '--sync-back');
      parsed.persist = true;
      i += 1;
      continue;
    }
    fail(`Unknown setup flag: ${arg}`);
  }
  return parsed;
}

function parseAuthArgs(args) {
  const parsed = { mode: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--mode') {
      parsed.mode = args[i + 1] || null;
      i += 1;
      continue;
    }
    fail(`Unknown auth flag: ${arg}`);
  }
  return parsed;
}

function parseBooleanFlagValue(rawValue, flagName) {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  fail(`Flag ${flagName} expects true or false.`);
}

function normalizeAuthModeValue(rawValue, context) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!authModeValues.has(value)) {
    fail(`${context} must be one of: oauth, api`);
  }
  return value;
}

function normalizeRunModeValue(rawValue, context) {
  const value = String(rawValue || '').trim();
  if (!runModeValues.has(value)) {
    fail(`${context} must be one of: linux-portable, host-native, linux-wsl`);
  }
  return value;
}

function normalizeWindowsModeValue(rawValue, context) {
  const value = normalizeRunModeValue(rawValue, context);
  if (!windowsDefaultModeValues.has(value)) {
    fail(`${context} must be one of: linux-portable, host-native`);
  }
  return value;
}

function defaultSettings() {
  return {
    version: 1,
    auth: {
      codex: 'oauth',
      claude: 'oauth'
    },
    runtime: {
      windows_default_mode: 'linux-portable',
      sync_back_default: true
    }
  };
}

function settingsFileExists() {
  return fs.existsSync(settingsPath);
}

function loadSettings() {
  if (!settingsFileExists()) {
    return defaultSettings();
  }
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON in ${path.relative(repoRoot, settingsPath)}: ${error.message}`);
  }
  return normalizeSettings(raw);
}

function normalizeSettings(raw) {
  const defaults = defaultSettings();
  const settings = {
    version: defaults.version,
    auth: {
      codex: defaults.auth.codex,
      claude: defaults.auth.claude
    },
    runtime: {
      windows_default_mode: defaults.runtime.windows_default_mode,
      sync_back_default: defaults.runtime.sync_back_default
    }
  };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail(`Settings file ${path.relative(repoRoot, settingsPath)} must contain a JSON object.`);
  }

  if (raw.auth !== undefined) {
    if (!raw.auth || typeof raw.auth !== 'object' || Array.isArray(raw.auth)) {
      fail('settings.auth must be an object when present.');
    }
    if (raw.auth.codex !== undefined) {
      settings.auth.codex = normalizeAuthModeValue(raw.auth.codex, 'settings.auth.codex');
    }
    if (raw.auth.claude !== undefined) {
      settings.auth.claude = normalizeAuthModeValue(raw.auth.claude, 'settings.auth.claude');
    }
  }

  if (raw.runtime !== undefined) {
    if (!raw.runtime || typeof raw.runtime !== 'object' || Array.isArray(raw.runtime)) {
      fail('settings.runtime must be an object when present.');
    }
    if (raw.runtime.windows_default_mode !== undefined) {
      settings.runtime.windows_default_mode = normalizeWindowsModeValue(
        raw.runtime.windows_default_mode,
        'settings.runtime.windows_default_mode'
      );
    }
    if (raw.runtime.sync_back_default !== undefined) {
      if (typeof raw.runtime.sync_back_default !== 'boolean') {
        fail('settings.runtime.sync_back_default must be true or false.');
      }
      settings.runtime.sync_back_default = raw.runtime.sync_back_default;
    }
  }

  return settings;
}

function saveSettings(settings) {
  ensureDir(stateDir);
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function printSettings(settings, initialized) {
  console.log('Settings');
  console.log(`  initialized: ${initialized ? 'yes' : 'no'}`);
  console.log(`  codex auth: ${settings.auth.codex}`);
  console.log(`  claude auth: ${settings.auth.claude}`);
  console.log(`  windows default mode: ${settings.runtime.windows_default_mode}`);
  console.log(`  sync back default: ${settings.runtime.sync_back_default ? 'true' : 'false'}`);
  console.log(`  settings file: ${path.relative(repoRoot, settingsPath)}`);
}

function printAuthStatus(settings, initialized) {
  console.log('Auth status');
  console.log(`  settings initialized: ${initialized ? 'yes' : 'no'}`);

  const tools = ['codex', 'claude'];
  for (const tool of tools) {
    const mode = getAuthModeForTool(tool, settings);
    const hostPaths = getPortableHostAuthPaths(tool);
    console.log(`  ${tool}: ${mode}`);
    if (mode === 'oauth') {
      console.log(`  ${tool} host oauth home: ${path.relative(repoRoot, hostPaths.home)}`);
      console.log(`  ${tool} vm oauth home: /home/portable/.pcoder-auth/${tool}`);
    } else {
      console.log(`  ${tool} api mode: inject provider key env vars at launch time`);
    }
  }
}

function findToolByDefaultProfile(profileName, adapters) {
  for (const [tool, adapter] of Object.entries(adapters)) {
    if (adapter.default_profile === profileName) {
      return tool;
    }
  }
  return null;
}

function getAuthModeForTool(tool, settings) {
  const mode = settings && settings.auth ? settings.auth[tool] : null;
  if (!mode) {
    return 'oauth';
  }
  return normalizeAuthModeValue(mode, `settings.auth.${tool}`);
}

function getPortableHostAuthPaths(tool) {
  const root = path.join(authStateRoot, tool, 'host');
  const home = path.join(root, 'home');
  const config = path.join(home, '.config');
  const cache = path.join(home, '.cache');
  const data = path.join(home, '.local', 'share');
  const state = path.join(home, '.local', 'state');
  return { root, home, config, cache, data, state };
}

function applyPortableHostAuthEnv(tool, env, settings) {
  const authMode = getAuthModeForTool(tool, settings);
  env.PCODER_AUTH_MODE = authMode;

  if (authMode !== 'oauth') {
    return env;
  }

  const authPaths = getPortableHostAuthPaths(tool);
  ensureDir(authPaths.root);
  ensureDir(authPaths.home);
  ensureDir(authPaths.config);
  ensureDir(authPaths.cache);
  ensureDir(authPaths.data);
  ensureDir(authPaths.state);

  env.HOME = authPaths.home;
  env.XDG_CONFIG_HOME = authPaths.config;
  env.XDG_CACHE_HOME = authPaths.cache;
  env.XDG_DATA_HOME = authPaths.data;
  env.XDG_STATE_HOME = authPaths.state;
  env.PCODER_AUTH_HOME = authPaths.home;

  if (process.platform === 'win32') {
    const appData = path.join(authPaths.home, 'AppData', 'Roaming');
    const localAppData = path.join(authPaths.home, 'AppData', 'Local');
    ensureDir(appData);
    ensureDir(localAppData);
    env.USERPROFILE = authPaths.home;
    env.APPDATA = appData;
    env.LOCALAPPDATA = localAppData;
  }

  if (tool === 'claude') {
    const claudeConfigDir = path.join(authPaths.home, '.claude');
    ensureDir(claudeConfigDir);
    env.CLAUDE_CONFIG_DIR = claudeConfigDir;
  }
  if (tool === 'codex') {
    const openaiHome = path.join(authPaths.home, '.openai');
    ensureDir(openaiHome);
    env.OPENAI_HOME = openaiHome;
  }

  return env;
}

function resolveRunMode(explicitMode, settings) {
  if (explicitMode) {
    return normalizeRunModeValue(explicitMode, '--mode');
  }
  if (process.platform === 'win32') {
    return settings.runtime.windows_default_mode || 'linux-portable';
  }
  return 'host-native';
}

function resolveProfileName(explicit, adapter, profiles) {
  if (explicit) {
    return explicit;
  }
  const active = readActiveProfile();
  if (active && (!adapter.default_profile || active === adapter.default_profile)) {
    return active;
  }
  if (adapter.default_profile) {
    return adapter.default_profile;
  }
  if (active) {
    return active;
  }
  return profiles.default_profile;
}

function loadProfileEnv(profile, requireFiles) {
  const env = {};
  const missingFiles = [];
  const files = Array.isArray(profile.env_files) ? profile.env_files : [];

  for (const rel of files) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      missingFiles.push(rel);
      continue;
    }
    Object.assign(env, parseEnvFile(abs));
  }

  if (requireFiles && missingFiles.length > 0) {
    fail(`Missing env file(s): ${missingFiles.join(', ')}. Provide profile files or switch to external env injection.`);
  }

  return { env, missingFiles };
}

function parseEnvFile(filePath) {
  const out = {};
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const idx = line.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function validateProfileRequirements(profile, env) {
  const required = Array.isArray(profile.required_env) ? profile.required_env : [];
  const missing = [];
  for (const key of required) {
    if (!env[key]) {
      missing.push(key);
    }
  }

  const requiredAnyGroups = Array.isArray(profile.required_env_any) ? profile.required_env_any : [];
  const failedAny = [];
  for (const group of requiredAnyGroups) {
    const keys = Array.isArray(group) ? group : [];
    const hasOne = keys.some((k) => Boolean(env[k]));
    if (!hasOne && keys.length > 0) {
      failedAny.push(keys);
    }
  }

  if (missing.length === 0 && failedAny.length === 0) {
    return { ok: true, message: 'ok' };
  }

  const parts = [];
  if (missing.length > 0) {
    parts.push(`missing all of: ${missing.join(', ')}`);
  }
  for (const keys of failedAny) {
    parts.push(`need one of: ${keys.join(' | ')}`);
  }

  return { ok: false, message: parts.join('; ') };
}

function applyToolCompatibilityEnv(tool, env) {
  if (tool === 'claude') {
    if (!env.ANTHROPIC_AUTH_TOKEN && env.ANTHROPIC_API_KEY) {
      env.ANTHROPIC_AUTH_TOKEN = env.ANTHROPIC_API_KEY;
    }
  }
}

function runInLinuxPortableVm(options) {
  const {
    tool,
    adapter,
    projectPath,
    mergedEnv,
    toolArgs,
    noSyncBack,
    skipProjectSync,
    authMode
  } = options;

  if (process.platform !== 'win32') {
    fail('linux-portable mode is currently implemented for Windows hosts only.');
  }

  loadJsonSafe(vmManifestPath, 'vm manifest');
  startWindowsVm();

  const sshPort = readVmSshPort();
  const sshHost = mergedEnv.PCODER_VM_HOST || '127.0.0.1';
  const sshUser = mergedEnv.PCODER_VM_USER || 'portable';
  const sshKeyPath = mergedEnv.PCODER_VM_SSH_KEY || path.join(repoRoot, 'runtime', 'linux', 'ssh', 'id_ed25519');
  if (!fs.existsSync(sshKeyPath)) {
    fail(`Missing VM SSH key: ${sshKeyPath}. Set PCODER_VM_SSH_KEY or provide runtime/linux/ssh/id_ed25519.`);
  }

  const sshCmd = resolveSshCommand(mergedEnv);
  const scpCmd = resolveScpCommand(mergedEnv, sshCmd);

  waitForVmSshReady({
    sshCmd,
    sshHost,
    sshPort,
    sshUser,
    sshKeyPath,
    timeoutSeconds: resolveVmSshTimeoutSeconds(mergedEnv)
  });

  const remoteRoot = mergedEnv.PCODER_VM_PROJECTS_ROOT || '/home/portable/projects';
  const remoteProjectPath = skipProjectSync
    ? (mergedEnv.PCODER_VM_AUTH_WORKDIR || '/home/portable')
    : buildRemoteProjectPath(remoteRoot, projectPath);
  const vmRunner = resolveVmToolRunner(tool, adapter, mergedEnv);

  const prepLines = ['set -e'];
  if (skipProjectSync) {
    prepLines.push(`mkdir -p ${shellEscape(remoteProjectPath)}`);
  } else {
    prepLines.push(`mkdir -p ${shellEscape(remoteRoot)}`);
    prepLines.push(`rm -rf ${shellEscape(remoteProjectPath)}`);
    prepLines.push(`mkdir -p ${shellEscape(remoteProjectPath)}`);
  }
  const prepScript = prepLines.join('\n');

  const prepResult = runSshScript({
    sshCmd,
    sshHost,
    sshPort,
    sshUser,
    sshKeyPath,
    script: prepScript,
    inheritOutput: true
  });
  if (prepResult.status !== 0) {
    fail('Failed to prepare remote project directory in VM.');
  }

  if (!skipProjectSync) {
    syncProjectToVm({
      scpCmd,
      sshHost,
      sshPort,
      sshUser,
      sshKeyPath,
      projectPath,
      remoteProjectPath
    });
  }

  const remoteScript = buildRemoteRunScript({
    tool,
    authMode,
    remoteProjectPath,
    vmRunner,
    toolArgs,
    mergedEnv
  });

  const runResult = runSshScript({
    sshCmd,
    sshHost,
    sshPort,
    sshUser,
    sshKeyPath,
    script: remoteScript,
    inheritOutput: true
  });

  if (!skipProjectSync && !noSyncBack) {
    syncProjectFromVm({
      scpCmd,
      sshHost,
      sshPort,
      sshUser,
      sshKeyPath,
      projectPath,
      remoteProjectPath
    });
  }

  process.exitCode = typeof runResult.status === 'number' ? runResult.status : 1;
}

function startWindowsVm() {
  const startScript = path.join(repoRoot, 'scripts', 'runtime', 'windows', 'start-vm.cmd');
  if (!fs.existsSync(startScript)) {
    fail(`Missing VM start script: ${startScript}`);
  }

  const result = cp.spawnSync('cmd.exe', ['/c', startScript], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  if (result.error) {
    fail(`Failed to execute VM start script: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`VM start script failed with exit code ${result.status}.`);
  }
}

function readVmSshPort() {
  if (!fs.existsSync(vmSshPortPath)) {
    fail(`Missing VM SSH port file: ${vmSshPortPath}. VM may not be initialized correctly.`);
  }
  const raw = fs.readFileSync(vmSshPortPath, 'utf8').trim();
  const port = Number.parseInt(raw, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    fail(`Invalid VM SSH port value in ${vmSshPortPath}: ${raw}`);
  }
  return String(port);
}

function resolveSshCommand(env) {
  const override = env.PCODER_SSH_CMD;
  if (override) {
    if (!commandOrPathExists(override)) {
      fail(`PCODER_SSH_CMD is set but not found: ${override}`);
    }
    return override;
  }

  const bundled = path.join(repoRoot, 'runtime', 'ssh', 'ssh.exe');
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  if (commandExists('ssh')) {
    return 'ssh';
  }

  fail('No SSH client found. Bundle runtime/ssh/ssh.exe or ensure ssh is available in PATH.');
}

function resolveScpCommand(env, sshCmd) {
  const override = env.PCODER_SCP_CMD;
  if (override) {
    if (!commandOrPathExists(override)) {
      fail(`PCODER_SCP_CMD is set but not found: ${override}`);
    }
    return override;
  }

  if (sshCmd.includes('/') || sshCmd.includes('\\')) {
    const sshDir = path.dirname(sshCmd);
    const siblingScp = path.join(sshDir, 'scp.exe');
    if (fs.existsSync(siblingScp)) {
      return siblingScp;
    }
  }

  const bundled = path.join(repoRoot, 'runtime', 'ssh', 'scp.exe');
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  if (commandExists('scp')) {
    return 'scp';
  }

  fail('No SCP client found. Bundle runtime/ssh/scp.exe or ensure scp is available in PATH.');
}

function waitForVmSshReady(options) {
  const {
    sshCmd,
    sshHost,
    sshPort,
    sshUser,
    sshKeyPath,
    timeoutSeconds
  } = options;

  const startedAt = Date.now();
  const timeoutMs = timeoutSeconds * 1000;
  while ((Date.now() - startedAt) < timeoutMs) {
    const probe = runSshScript({
      sshCmd,
      sshHost,
      sshPort,
      sshUser,
      sshKeyPath,
      script: 'echo vm-ready',
      inheritOutput: false
    });
    if (probe.status === 0) {
      return;
    }
    sleepMs(2000);
  }

  fail(`Timed out waiting for VM SSH readiness after ${timeoutSeconds}s.`);
}

function resolveVmSshTimeoutSeconds(env) {
  const raw = env.PCODER_VM_SSH_TIMEOUT_SECONDS;
  if (!raw) {
    return 300;
  }
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 10 || parsed > 3600) {
    fail('PCODER_VM_SSH_TIMEOUT_SECONDS must be an integer between 10 and 3600.');
  }
  return parsed;
}

function resolveVmToolRunner(tool, adapter, env) {
  const overrideKey = `PCODER_VM_${tool.toUpperCase()}_CMD`;
  if (env[overrideKey]) {
    return env[overrideKey];
  }
  if (adapter.candidate_commands && adapter.candidate_commands.length > 0) {
    return adapter.candidate_commands[0];
  }
  return tool;
}

function buildRemoteProjectPath(remoteRoot, projectPath) {
  const normalizedRoot = remoteRoot.endsWith('/') ? remoteRoot.slice(0, -1) : remoteRoot;
  const baseRaw = path.basename(projectPath) || 'project';
  const baseSafe = baseRaw.replace(/[^A-Za-z0-9._-]/g, '_');
  const hash = crypto.createHash('sha1').update(projectPath.toLowerCase()).digest('hex').slice(0, 8);
  return `${normalizedRoot}/${baseSafe}-${hash}`;
}

function buildRemoteRunScript(options) {
  const {
    tool,
    authMode,
    remoteProjectPath,
    vmRunner,
    toolArgs,
    mergedEnv
  } = options;

  const forwardKeys = [
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_ORG_ID',
    'OPENAI_PROJECT',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'ALL_PROXY'
  ];

  const lines = [
    'set -e',
    `cd ${shellEscape(remoteProjectPath)}`
  ];

  if ((authMode || 'oauth') === 'oauth') {
    const vmAuthHome = mergedEnv.PCODER_VM_AUTH_HOME || `/home/portable/.pcoder-auth/${tool}`;
    const vmConfig = `${vmAuthHome}/.config`;
    const vmCache = `${vmAuthHome}/.cache`;
    const vmData = `${vmAuthHome}/.local/share`;
    const vmState = `${vmAuthHome}/.local/state`;
    lines.push(`mkdir -p ${shellEscape(vmConfig)} ${shellEscape(vmCache)} ${shellEscape(vmData)} ${shellEscape(vmState)}`);
    lines.push(`export HOME=${shellEscape(vmAuthHome)}`);
    lines.push(`export XDG_CONFIG_HOME=${shellEscape(vmConfig)}`);
    lines.push(`export XDG_CACHE_HOME=${shellEscape(vmCache)}`);
    lines.push(`export XDG_DATA_HOME=${shellEscape(vmData)}`);
    lines.push(`export XDG_STATE_HOME=${shellEscape(vmState)}`);
    if (tool === 'claude') {
      lines.push(`export CLAUDE_CONFIG_DIR=${shellEscape(`${vmAuthHome}/.claude`)}`);
      lines.push(`mkdir -p ${shellEscape(`${vmAuthHome}/.claude`)}`);
    }
    if (tool === 'codex') {
      lines.push(`export OPENAI_HOME=${shellEscape(`${vmAuthHome}/.openai`)}`);
      lines.push(`mkdir -p ${shellEscape(`${vmAuthHome}/.openai`)}`);
    }
  }

  lines.push(`export PCODER_AUTH_MODE=${shellEscape(authMode || 'oauth')}`);

  for (const key of forwardKeys) {
    if (mergedEnv[key]) {
      lines.push(`export ${key}=${shellEscape(mergedEnv[key])}`);
    }
  }

  const cmdParts = [vmRunner, ...toolArgs].map((part) => shellEscape(part));
  lines.push(cmdParts.join(' '));
  return lines.join('\n');
}

function syncProjectToVm(options) {
  const {
    scpCmd,
    sshHost,
    sshPort,
    sshUser,
    sshKeyPath,
    projectPath,
    remoteProjectPath
  } = options;

  const args = [
    '-P', String(sshPort),
    '-i', sshKeyPath,
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=no',
    '-o', `UserKnownHostsFile=${knownHostsNullPath()}`,
    '-r',
    '.',
    `${sshUser}@${sshHost}:${remoteProjectPath}`
  ];

  const result = cp.spawnSync(scpCmd, args, {
    cwd: projectPath,
    stdio: 'inherit'
  });

  if (result.error) {
    fail(`Failed to sync project into VM: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`Project sync to VM failed with exit code ${result.status}.`);
  }
}

function syncProjectFromVm(options) {
  const {
    scpCmd,
    sshHost,
    sshPort,
    sshUser,
    sshKeyPath,
    projectPath,
    remoteProjectPath
  } = options;

  const args = [
    '-P', String(sshPort),
    '-i', sshKeyPath,
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=no',
    '-o', `UserKnownHostsFile=${knownHostsNullPath()}`,
    '-r',
    `${sshUser}@${sshHost}:${remoteProjectPath}/.`,
    '.'
  ];

  const result = cp.spawnSync(scpCmd, args, {
    cwd: projectPath,
    stdio: 'inherit'
  });

  if (result.error) {
    fail(`Failed to sync project back from VM: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`Project sync-back from VM failed with exit code ${result.status}.`);
  }
}

function runSshScript(options) {
  const {
    sshCmd,
    sshHost,
    sshPort,
    sshUser,
    sshKeyPath,
    script,
    inheritOutput
  } = options;

  const args = [
    '-p', String(sshPort),
    '-i', sshKeyPath,
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=no',
    '-o', `UserKnownHostsFile=${knownHostsNullPath()}`,
    '-o', 'ConnectTimeout=5',
    `${sshUser}@${sshHost}`,
    'bash', '-s'
  ];

  const result = cp.spawnSync(sshCmd, args, {
    input: script,
    encoding: 'utf8',
    stdio: inheritOutput ? ['pipe', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe']
  });

  if (result.error) {
    fail(`SSH command failed to start: ${result.error.message}`);
  }
  return result;
}

function shellEscape(value) {
  const raw = String(value);
  return `'${raw.replace(/'/g, `'\"'\"'`)}'`;
}

function knownHostsNullPath() {
  return process.platform === 'win32' ? 'NUL' : '/dev/null';
}

function commandOrPathExists(commandOrPath) {
  if (commandOrPath.includes('/') || commandOrPath.includes('\\') || /^[A-Za-z]:\\/.test(commandOrPath)) {
    return fs.existsSync(commandOrPath);
  }
  return commandExists(commandOrPath);
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function resolveRunner(adapter, env) {
  const overrideKey = adapter.command_env;
  if (overrideKey && env[overrideKey]) {
    return env[overrideKey];
  }

  for (const candidate of adapter.candidate_commands || []) {
    if (commandExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function commandExists(command) {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = cp.spawnSync(checker, [command], {
    stdio: 'ignore'
  });
  return result.status === 0;
}

function readActiveProfile() {
  if (!fs.existsSync(activeProfilePath)) {
    return '';
  }
  return fs.readFileSync(activeProfilePath, 'utf8').trim();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadJsonSafe(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${label}: ${path.relative(repoRoot, filePath)}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON in ${path.relative(repoRoot, filePath)}: ${error.message}`);
  }
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

main(process.argv.slice(2));
