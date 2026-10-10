// LUNAR CLI Website Interactive Engine
(function() {
  'use strict';

  // ─── 1. ASTRONOMICAL MOON PHASE ENGINE ────────────────────────────
  function computeMoonPhase(date = new Date()) {
    const synodicMonth = 29.53058867;
    const refNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
    const diffDays = (date.getTime() - refNewMoon) / (1000 * 60 * 60 * 24);
    const cycle = (diffDays % synodicMonth + synodicMonth) % synodicMonth;
    const phaseFraction = cycle / synodicMonth;
    const illumination = Math.round((1 - Math.cos(phaseFraction * 2 * Math.PI)) / 2 * 100);

    let phaseName = 'New Moon';
    let glyph = '🌑';

    if (cycle < 1.84566) {
      phaseName = 'New Moon'; glyph = '🌑';
    } else if (cycle < 5.53699) {
      phaseName = 'Waxing Crescent'; glyph = '🌒';
    } else if (cycle < 9.22831) {
      phaseName = 'First Quarter'; glyph = '🌓';
    } else if (cycle < 12.91963) {
      phaseName = 'Waxing Gibbous'; glyph = '🌔';
    } else if (cycle < 16.61096) {
      phaseName = 'Full Moon'; glyph = '🌕';
    } else if (cycle < 20.30228) {
      phaseName = 'Waning Gibbous'; glyph = '🌖';
    } else if (cycle < 23.99361) {
      phaseName = 'Last Quarter'; glyph = '🌗';
    } else if (cycle < 27.68493) {
      phaseName = 'Waning Crescent'; glyph = '🌘';
    } else {
      phaseName = 'New Moon'; glyph = '🌑';
    }

    const fullMoonCycle = 14.765;
    let daysToFull = fullMoonCycle - cycle;
    if (daysToFull < 0) daysToFull += synodicMonth;

    return {
      phaseName,
      glyph,
      illumination,
      daysToFull: daysToFull.toFixed(1),
      cycle: cycle.toFixed(1)
    };
  }

  function updateAstronomicalWidgets() {
    const moon = computeMoonPhase();

    // Header badge
    const headerGlyph = document.getElementById('headerPhaseGlyph');
    const headerName = document.getElementById('headerPhaseName');
    if (headerGlyph) headerGlyph.textContent = moon.glyph;
    if (headerName) headerName.textContent = `${moon.phaseName} • ${moon.illumination}%`;

    // Hero widget
    const widgetPhaseName = document.getElementById('widgetPhaseName');
    const widgetIllumination = document.getElementById('widgetIllumination');
    const widgetNextFull = document.getElementById('widgetNextFull');
    if (widgetPhaseName) widgetPhaseName.textContent = `${moon.glyph} ${moon.phaseName}`;
    if (widgetIllumination) widgetIllumination.textContent = `${moon.illumination}% illuminated`;
    if (widgetNextFull) widgetNextFull.textContent = `${moon.daysToFull} days`;

    // Dynamic Moon Shadow Shader
    const shadow = document.getElementById('moonShadowOverlay');
    if (shadow) {
      // Adjust shadow gradient based on illumination
      const illumPct = moon.illumination;
      shadow.style.background = `linear-gradient(90deg, transparent ${illumPct * 0.7}%, rgba(3, 5, 10, 0.9) ${Math.min(100, illumPct + 35)}%)`;
    }
  }

  // ─── 2. STARFIELD CANVAS ANIMATION ────────────────────────────────
  function initStarfield() {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const starCount = Math.floor((width * height) / 3800);
    const stars = [];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleDir: Math.random() > 0.5 ? 1 : -1,
        color: Math.random() > 0.85 ? '#67e8f9' : (Math.random() > 0.7 ? '#c084fc' : '#ffffff')
      });
    }

    let mouseX = width / 2;
    let mouseY = height / 2;
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function renderStars() {
      ctx.clearRect(0, 0, width, height);

      const dx = (mouseX - width / 2) * 0.015;
      const dy = (mouseY - height / 2) * 0.015;

      for (let s of stars) {
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha > 0.95) { s.alpha = 0.95; s.twinkleDir = -1; }
        if (s.alpha < 0.15) { s.alpha = 0.15; s.twinkleDir = 1; }

        ctx.beginPath();
        ctx.arc(s.x + dx * (s.size * 0.5), s.y + dy * (s.size * 0.5), s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.alpha;
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
      requestAnimationFrame(renderStars);
    }

    renderStars();
  }

  // ─── 3. INTERACTIVE TERMINAL SIMULATOR ────────────────────────────
  const terminalScreen = document.getElementById('terminalScreen');
  const terminalTitle = document.getElementById('terminalTitle');
  const scenarioTabs = document.querySelectorAll('.scenario-tabs .tab-btn');
  const terminalReplBar = document.getElementById('terminalReplBar');
  const termInput = document.getElementById('termInput');
  const termSendBtn = document.getElementById('termSendBtn');
  const termRestartBtn = document.getElementById('termRestartBtn');

  let currentScenario = 'surgical-edit';
  let animationTimeout = null;

  const SCENARIOS = {
    'surgical-edit': [
      { type: 'header', text: '☾ LUNAR  🌘  moonlit terminal agent  v2.3.0\nProvider: openrouter (apodex/apodex-1.1-mini) • Permission: ask\n' },
      { type: 'prompt', text: 'Refactor JWT authentication: enforce 15m expiration and record audit log' },
      { type: 'spinner', text: '◐ Planning surgical replacement in src/auth/jwt.mjs...' },
      {
        type: 'card',
        html: `
<div class="term-card" style="border-color: rgba(245, 158, 11, 0.4);">
  <div class="term-card-title" style="color: #fbbf24;">⚡ SURGICAL EDIT &nbsp;<span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">src/auth/jwt.mjs</span></div>
  <div style="font-size:0.8rem; color:#94a3b8; margin-bottom:8px;">Replacing lines 142-143 (Single contiguous atomic block)</div>
  <div style="font-family: var(--font-mono); font-size: 0.825rem; background: #03050a; padding: 10px; border-radius: 6px;">
    <div class="term-diff-rem">-  const token = jwt.sign(payload, secret);</div>
    <div class="term-diff-add">+  const token = jwt.sign(payload, secret, { expiresIn: '15m' });</div>
    <div class="term-diff-add">+  await auditLogger.recordTokenIssuance(payload.userId, 'jwt:login');</div>
  </div>
  <div style="margin-top: 8px; font-size: 0.75rem; color: #64748b;">
    ● Checkpoint backup created: <code>.lunar/backups/jwt.mjs.1791632.bak</code>
  </div>
</div>`
      },
      {
        type: 'approval',
        text: 'Action requires approval: Apply surgical replacement to src/auth/jwt.mjs?\n[y] Approve   [n] Deny   [a] YOLO Mode   [e] Explain change'
      },
      { type: 'user_action', text: 'y', delay: 1200 },
      {
        type: 'success',
        text: '✓ Replacement applied successfully (2 lines inserted, 1 deleted)\n✓ Verification: node tests/auth.test.mjs\n  ok 1 - jwt token expires within 900 seconds\n  ok 2 - audit log successfully records user event\n✓ All tests passed (118ms)'
      }
    ],

    'flight-plan': [
      { type: 'header', text: '☾ LUNAR  🌘  moonlit terminal agent  v2.3.0\nProvider: openrouter (nvidia/nemotron-3.5-lightning:free)\n' },
      { type: 'prompt', text: 'Execute flight plan: Migrate database schemas to SQLite native driver' },
      { type: 'spinner', text: '◐ Orbiting workspace dependencies...' },
      {
        type: 'card',
        html: `
<div class="term-card" style="border-color: rgba(167, 139, 250, 0.4);">
  <div class="term-card-title" style="color: #a78bfa;">📋 ORBITAL FLIGHT PLAN &nbsp;<span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">3 of 4 Tasks Completed</span></div>
  <div style="background: rgba(255,255,255,0.08); height: 6px; border-radius: 9999px; margin-bottom: 8px; overflow: hidden;">
    <div style="width: 75%; height: 100%; background: linear-gradient(90deg, #38bdf8, #a78bfa);"></div>
  </div>
  <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 8px;">Trajectory: [████████░░] 75%</div>
  <div style="font-size: 0.825rem; line-height: 1.8;">
    <div style="color: #34d399;">● 1. Audit node:sqlite standard library availability (Node >= 22.5)</div>
    <div style="color: #34d399;">● 2. Rewrite db/connection.mjs using node:sqlite DatabaseSync</div>
    <div style="color: #38bdf8; font-weight: 600;">◐ 3. Migrate SQL migrations runner to atomic transactions</div>
    <div style="color: #64748b;">○ 4. Run full diagnostic test suite & benchmark query latency</div>
  </div>
</div>`
      },
      { type: 'success', text: '✓ Step 3 completed in 240ms: Atomic transactions wrapped with immediate rollback safety.' }
    ],

    'web-discovery': [
      { type: 'header', text: '☾ LUNAR  🌘  moonlit terminal agent  v2.3.0\nProvider: ollama (gemma4:gpu - local offline)\n' },
      { type: 'prompt', text: 'Find why crypto.randomUUID() behaves differently in Node worker threads' },
      {
        type: 'card',
        html: `
<div class="term-card" style="border-color: rgba(56, 189, 248, 0.4);">
  <div class="term-card-title" style="color: #38bdf8;">🔎 SEARCH CODEBASE &nbsp;<span style="font-size:0.75rem; color:#94a3b8;">/worker_threads/</span></div>
  <div style="font-size: 0.8rem; color: #cbd5e1;">Found 3 matches across <code>src/workers/pool.mjs</code></div>
</div>`
      },
      {
        type: 'card',
        html: `
<div class="term-card" style="border-color: rgba(45, 212, 191, 0.4);">
  <div class="term-card-title" style="color: #2dd4bf;">🌐 WEB DISCOVERY &nbsp;<span style="font-size:0.75rem; color:#34d399;">HTTP 200 OK</span></div>
  <div style="font-size: 0.8rem; color: #94a3b8;">URL: https://nodejs.org/api/webcrypto.html#cryptorandomuuid</div>
  <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 4px;">Extracted 8,420 chars • Markdown parsed • CSP & scripts stripped</div>
</div>`
      },
      {
        type: 'success',
        text: 'Root cause identified: Web Crypto API requires globalThis.crypto initialization in isolated thread contexts.\nApplying surgical patch to worker bootstrap pool.'
      }
    ]
  };

  function playScenario(scenarioKey) {
    if (animationTimeout) clearTimeout(animationTimeout);
    terminalScreen.innerHTML = '';

    if (scenarioKey === 'interactive-repl') {
      terminalReplBar.style.display = 'flex';
      terminalTitle.textContent = '☾ lunar — REPL Interactive Terminal';
      renderReplWelcome();
      return;
    } else {
      terminalReplBar.style.display = 'none';
      terminalTitle.textContent = '☾ lunar — ~/hyper-orbit (openrouter: apodex-1.1-mini)';
    }

    const steps = SCENARIOS[scenarioKey] || [];
    let currentStepIndex = 0;

    function nextStep() {
      if (currentStepIndex >= steps.length) return;
      const step = steps[currentStepIndex++];

      if (step.type === 'header') {
        const el = document.createElement('div');
        el.className = 'term-header';
        el.innerText = step.text;
        terminalScreen.appendChild(el);
        animationTimeout = setTimeout(nextStep, 350);
      } else if (step.type === 'prompt') {
        const line = document.createElement('div');
        line.className = 'term-line';
        line.innerHTML = `<span style="color:#38bdf8; font-weight:700;">❯</span> <span style="color:#fff;">${step.text}</span>`;
        terminalScreen.appendChild(line);
        animationTimeout = setTimeout(nextStep, 600);
      } else if (step.type === 'spinner') {
        const spinLine = document.createElement('div');
        spinLine.className = 'term-line';
        spinLine.innerHTML = `<span class="term-spinner">${step.text}</span>`;
        terminalScreen.appendChild(spinLine);
        animationTimeout = setTimeout(() => {
          spinLine.remove();
          nextStep();
        }, 900);
      } else if (step.type === 'card') {
        const cardContainer = document.createElement('div');
        cardContainer.innerHTML = step.html;
        terminalScreen.appendChild(cardContainer);
        animationTimeout = setTimeout(nextStep, 700);
      } else if (step.type === 'approval') {
        const appLine = document.createElement('div');
        appLine.className = 'term-prompt-line';
        appLine.innerText = step.text;
        terminalScreen.appendChild(appLine);
        animationTimeout = setTimeout(nextStep, 1000);
      } else if (step.type === 'user_action') {
        const actionLine = document.createElement('div');
        actionLine.className = 'term-line';
        actionLine.innerHTML = `<span style="color:#fbbf24; font-weight:700;">Action selected: [${step.text}]</span>`;
        terminalScreen.appendChild(actionLine);
        animationTimeout = setTimeout(nextStep, 500);
      } else if (step.type === 'success') {
        const succLine = document.createElement('div');
        succLine.className = 'term-line';
        succLine.style.color = '#34d399';
        succLine.innerText = step.text;
        terminalScreen.appendChild(succLine);
      }

      terminalScreen.scrollTop = terminalScreen.scrollHeight;
    }

    nextStep();
  }

  function renderReplWelcome() {
    terminalScreen.innerHTML = `
<div class="term-header">
  ☾ LUNAR CLI  🌘  moonlit terminal agent  v2.3.0<br>
  Interactive Browser Emulation • Node.js Native Zero-Dep Engine
</div>
<div class="term-line" style="color: #94a3b8;">
  Type commands below to interact. Try:<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">doctor</code> &nbsp;— Run orbital diagnostic matrix<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">phase</code> &nbsp;— Calculate real-time synodic moon cycle<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">todos</code> &nbsp;— Inspect active flight plan progress bar<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">help</code> &nbsp;— View CLI commands and keyboard shortcuts<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">clear</code> &nbsp;— Clear terminal output
</div>
`;
    termInput.focus();
  }

  function handleReplInput() {
    const val = termInput.value.trim();
    if (!val) return;
    termInput.value = '';

    // Print command line
    const userLine = document.createElement('div');
    userLine.className = 'term-line';
    userLine.innerHTML = `<span style="color:#38bdf8; font-weight:700;">lunar ❯</span> <span style="color:#fff;">${val}</span>`;
    terminalScreen.appendChild(userLine);

    const cmd = val.toLowerCase();
    const resp = document.createElement('div');
    resp.className = 'term-line';

    if (cmd === 'clear') {
      renderReplWelcome();
      return;
    } else if (cmd === 'help') {
      resp.innerHTML = `
<div style="color: #e2e8f0; line-height: 1.6;">
  <strong>LUNAR CLI COMMANDS</strong><br>
  &nbsp;&nbsp;/mode &lt;ask|auto|plan|yolo&gt; &nbsp;Set agent permission shield<br>
  &nbsp;&nbsp;/model &lt;model_id&gt; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Switch active LLM model<br>
  &nbsp;&nbsp;/undo &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rollback previous file modification<br>
  &nbsp;&nbsp;@&lt;filepath&gt; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Inject file context into prompt<br>
  &nbsp;&nbsp;!&lt;shell_cmd&gt; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Escape to host bash/powershell
</div>`;
    } else if (cmd === 'doctor') {
      resp.innerHTML = `
<div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(56,189,248,0.3); border-radius: 6px; padding: 12px; font-size: 0.85rem;">
  <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px;">─── LUNAR ORBITAL CONNECTIVITY & HEALTH MATRIX ───</div>
  <div>Node Runtime &nbsp;&nbsp;&nbsp;&nbsp;: v26.5.0 (win32 x64)</div>
  <div>Active Provider &nbsp;: openrouter</div>
  <div>Active Model &nbsp;&nbsp;&nbsp;&nbsp;: apodex/apodex-1.1-mini:free</div>
  <div>Ollama Local &nbsp;&nbsp;&nbsp;&nbsp;: online [gemma4:gpu]</div>
  <div>Model Ping &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <span style="color:#34d399;">200 OK (ready to code!)</span></div>
  <div>Workspace Guide : LUNAR.md present</div>
  <div style="color: #34d399; margin-top: 6px;">+ All systems nominal. Ready for orbit.</div>
</div>`;
    } else if (cmd === 'phase') {
      const m = computeMoonPhase();
      resp.innerHTML = `
<div style="color: #38bdf8;">
  <strong>Real-time Astronomical Cycle:</strong><br>
  Phase: ${m.glyph} ${m.phaseName}<br>
  Illumination: ${m.illumination}%<br>
  Days Until Full Moon: ${m.daysToFull} days<br>
  Synodic Day: ${m.cycle} of 29.53
</div>`;
    } else if (cmd === 'todos') {
      resp.innerHTML = `
<div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(167,139,250,0.3); border-radius: 6px; padding: 12px;">
  <div style="color: #a78bfa; font-weight: bold;">Flight Plan: Trajectory [████████░░] 80%</div>
  <div style="color: #34d399;">● 1. Audit JWT signing tokens & expiration</div>
  <div style="color: #34d399;">● 2. Implement audit logger integration</div>
  <div style="color: #34d399;">● 3. Write unit & integration test coverage</div>
  <div style="color: #38bdf8;">◐ 4. Verify diagnostic matrix with doctor</div>
  <div style="color: #64748b;">○ 5. Push commit to git main branch</div>
</div>`;
    } else {
      resp.innerHTML = `
<div style="color: #cbd5e1;">
  <span class="term-spinner">◐ Lunar agent thinking...</span><br>
  <span style="color: #34d399;">✓</span> Simulated agent response to "<em>${val}</em>": Ready to edit files, inspect git status, or formulate flight plans.
</div>`;
    }

    terminalScreen.appendChild(resp);
    terminalScreen.scrollTop = terminalScreen.scrollHeight;
  }

  // Bind scenario tabs
  scenarioTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      scenarioTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentScenario = tab.getAttribute('data-scenario');
      playScenario(currentScenario);
    });
  });

  if (termRestartBtn) {
    termRestartBtn.addEventListener('click', () => {
      playScenario(currentScenario);
    });
  }

  if (termSendBtn) {
    termSendBtn.addEventListener('click', handleReplInput);
  }

  if (termInput) {
    termInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleReplInput();
    });
  }

  // ─── 4. COPY COMMAND & TOAST FEEDBACK ─────────────────────────────
  const toast = document.getElementById('toast');
  function showToast(msg = 'Copied to clipboard!') {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function copyTextToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
      if (btnElement) {
        btnElement.classList.add('copied');
        setTimeout(() => btnElement.classList.remove('copied'), 2000);
      }
    }).catch(() => {
      showToast('Failed to copy');
    });
  }

  const heroCopyBtn = document.getElementById('heroCopyBtn');
  if (heroCopyBtn) {
    heroCopyBtn.addEventListener('click', () => {
      const code = document.getElementById('heroInstallCommand').innerText;
      copyTextToClipboard(code, heroCopyBtn);
    });
  }

  document.querySelectorAll('.snippet-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy');
      copyTextToClipboard(text, btn);
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = original, 1800);
    });
  });

  // ─── 5. CONFIG GENERATOR LOGIC ────────────────────────────────────
  const configPreview = document.getElementById('configJsonPreview');
  const copyConfigBtn = document.getElementById('copyConfigBtn');
  const providerRadios = document.querySelectorAll('input[name="providerSelect"]');

  const CONFIG_TEMPLATES = {
    openrouter: {
      provider: "openrouter",
      model: "nvidia/nemotron-3.5-lightning:free",
      openrouterApiKey: "sk-or-v1-YOUR_OPENROUTER_KEY",
      temperature: 0.2,
      permissionMode: "ask",
      streaming: true
    },
    ollama: {
      provider: "ollama",
      model: "gemma4:gpu",
      ollamaHost: "http://localhost:11434",
      temperature: 0.2,
      permissionMode: "auto",
      streaming: true
    },
    custom: {
      provider: "custom",
      model: "deepseek-coder",
      customEndpoint: "https://your-custom-llm.internal/v1",
      customApiKey: "sk-internal-token",
      temperature: 0.1,
      permissionMode: "ask",
      streaming: true
    }
  };

  function updateConfigPreview() {
    let selected = 'openrouter';
    providerRadios.forEach(r => {
      if (r.checked) selected = r.value;
    });

    const cfg = CONFIG_TEMPLATES[selected] || CONFIG_TEMPLATES.openrouter;
    if (configPreview) {
      configPreview.textContent = JSON.stringify(cfg, null, 2);
    }
  }

  providerRadios.forEach(r => {
    r.addEventListener('change', updateConfigPreview);
  });

  if (copyConfigBtn) {
    copyConfigBtn.addEventListener('click', () => {
      if (configPreview) {
        copyTextToClipboard(configPreview.textContent, copyConfigBtn);
        showToast('Config JSON copied!');
      }
    });
  }

  // ─── INITIALIZATION ───────────────────────────────────────────────
  updateAstronomicalWidgets();
  initStarfield();
  playScenario('surgical-edit');

  // Periodically refresh moon phase calculations
  setInterval(updateAstronomicalWidgets, 60000);
})();
