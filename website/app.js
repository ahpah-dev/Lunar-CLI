// LUNAR CLI Website Interactive Engine v2.3.0
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
      const illumPct = moon.illumination;
      shadow.style.background = `linear-gradient(90deg, transparent ${illumPct * 0.7}%, rgba(3, 5, 10, 0.9) ${Math.min(100, illumPct + 35)}%)`;
    }
  }

  // ─── 2. STARFIELD & METEOR CANVAS ANIMATION ───────────────────────
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

    const starCount = Math.floor((width * height) / 3600);
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

    // Shooting meteors pool
    const meteors = [];
    function spawnMeteor() {
      if (meteors.length >= 2) return;
      meteors.push({
        x: Math.random() * width * 0.8 + width * 0.1,
        y: Math.random() * (height * 0.3),
        length: Math.random() * 80 + 50,
        speed: Math.random() * 8 + 6,
        alpha: 1.0,
        angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1)
      });
    }

    // Spawn meteor occasionally every 4-8 seconds
    setInterval(() => {
      if (Math.random() > 0.3) spawnMeteor();
    }, 4500);

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

      // Draw twinkling stars
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

      // Draw shooting meteors
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        const tailX = m.x - Math.cos(m.angle) * m.length;
        const tailY = m.y - Math.sin(m.angle) * m.length;

        const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        grad.addColorStop(1, `rgba(255, 255, 255, ${m.alpha})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        m.alpha -= 0.015;

        if (m.alpha <= 0 || m.x > width || m.y > height) {
          meteors.splice(i, 1);
        }
      }

      ctx.globalAlpha = 1.0;
      requestAnimationFrame(renderStars);
    }

    renderStars();
  }

  // ─── 3. 3D MOON ORB PARALLAX ──────────────────────────────────────
  function initMoonParallax() {
    const orb = document.getElementById('moonOrbWrapper');
    if (!orb) return;

    window.addEventListener('mousemove', (e) => {
      const rect = orb.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) / (window.innerWidth / 2);
      const deltaY = (e.clientY - centerY) / (window.innerHeight / 2);

      const rotY = deltaX * 18;
      const rotX = -deltaY * 18;
      orb.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });
  }

  // ─── 4. SPOTLIGHT CARD MOUSE TRACKER ──────────────────────────────
  function initSpotlightCards() {
    const cards = document.querySelectorAll('.spotlight-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  }

  // ─── 5. INTERACTIVE TERMINAL SIMULATOR ────────────────────────────
  const terminalScreen = document.getElementById('terminalScreen');
  const terminalTitle = document.getElementById('terminalTitle');
  const scenarioTabs = document.querySelectorAll('.scenario-tabs .tab-btn');
  const terminalReplBar = document.getElementById('terminalReplBar');
  const termInput = document.getElementById('termInput');
  const termSendBtn = document.getElementById('termSendBtn');
  const termRestartBtn = document.getElementById('termRestartBtn');
  const chipButtons = document.querySelectorAll('.chip-btn');

  let currentScenario = 'surgical-edit';
  let animationTimeout = null;
  const commandHistory = [];
  let historyIndex = -1;

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
  Select a quick-run chip or type any command below:<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">doctor</code> &nbsp;— Run orbital diagnostic matrix<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">phase</code> &nbsp;— Calculate real-time synodic moon cycle<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">todos</code> &nbsp;— Inspect active flight plan progress bar<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">models</code> &nbsp;— List available free & local models<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">git status</code> — Check git working tree<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">help</code> &nbsp;— View CLI commands and keyboard shortcuts<br>
  &nbsp;&nbsp;• <code style="color:#38bdf8;">clear</code> &nbsp;— Clear terminal output
</div>
`;
    termInput.focus();
  }

  function executeReplCommand(inputVal) {
    const val = inputVal.trim();
    if (!val) return;

    commandHistory.push(val);
    historyIndex = commandHistory.length;

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
  <strong>LUNAR CLI COMMANDS & SHORTCUTS</strong><br>
  &nbsp;&nbsp;/mode &lt;ask|auto|plan|yolo&gt; &nbsp;Set agent permission shield<br>
  &nbsp;&nbsp;/model &lt;model_id&gt; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Switch active LLM model<br>
  &nbsp;&nbsp;/undo &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rollback previous file modification<br>
  &nbsp;&nbsp;@&lt;filepath&gt; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Inject file context into prompt<br>
  &nbsp;&nbsp;!&lt;shell_cmd&gt; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Escape to host bash/powershell
</div>`;
    } else if (cmd === 'doctor') {
      resp.innerHTML = `
<div style="background: rgba(15,23,42,0.85); border: 1px solid rgba(56,189,248,0.3); border-radius: 6px; padding: 14px; font-size: 0.85rem;">
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
<div style="color: #38bdf8; background: rgba(15,23,42,0.8); border: 1px solid rgba(56,189,248,0.25); border-radius: 6px; padding: 12px;">
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
    } else if (cmd === 'models') {
      resp.innerHTML = `
<div style="background: rgba(15,23,42,0.85); border: 1px solid rgba(56,189,248,0.3); border-radius: 6px; padding: 12px; font-size: 0.825rem;">
  <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px;">AVAILABLE LUNAR MODELS</div>
  <div style="color: #34d399;">● apodex/apodex-1.1-mini:free &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[OpenRouter • Fast coding]</div>
  <div style="color: #34d399;">● nvidia/nemotron-3.5-lightning:free &nbsp;[OpenRouter • Reasoning]</div>
  <div style="color: #60a5fa;">● ollama/gemma4:gpu &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[Local Offline GPU]</div>
  <div style="color: #60a5fa;">● ollama/qwen2.5-coder:7b &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[Local Offline Code]</div>
  <div style="color: #a78bfa;">● anthropic/claude-3.7-sonnet &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[Frontier Reasoning]</div>
</div>`;
    } else if (cmd === 'git status') {
      resp.innerHTML = `
<div style="font-family: var(--font-mono); font-size: 0.825rem; color: #94a3b8;">
  On branch main<br>
  Your branch is up to date with 'origin/main'.<br>
  <span style="color: #34d399;">nothing to commit, working tree clean</span>
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

  function handleReplInput() {
    const val = termInput.value.trim();
    if (!val) return;
    termInput.value = '';
    executeReplCommand(val);
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
      if (e.key === 'Enter') {
        handleReplInput();
      } else if (e.key === 'ArrowUp') {
        if (historyIndex > 0) {
          historyIndex--;
          termInput.value = commandHistory[historyIndex] || '';
        }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          termInput.value = commandHistory[historyIndex] || '';
        } else {
          historyIndex = commandHistory.length;
          termInput.value = '';
        }
        e.preventDefault();
      }
    });
  }

  chipButtons.forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-run');
      if (cmd) executeReplCommand(cmd);
    });
  });

  // ─── 6. PERSONAS SHOWCASE ─────────────────────────────────────────
  const PERSONAS = {
    vibe: {
      badge: "🚀 VIBE PERSONA",
      role: "Momentum Pair-Programmer",
      instruction: '"Prioritizes high momentum, clean working code, and rapid iteration. Cuts through over-engineering to deliver immediate solutions with concise explanations."',
      sample: "☾ lunar ❯ Refactored payment webhook to use idempotent Redis locks in 38 lines.\nTests are passing, retry queue configured. Ready to ship."
    },
    architect: {
      badge: "🏛️ ARCHITECT PERSONA",
      role: "Systems Design & Contracts",
      instruction: '"Focuses on boundary interfaces, decoupled module contracts, failure domains, and backwards-compatibility before writing executable lines."',
      sample: "☾ lunar ❯ Proposed system boundary split between AuthGateway and TokenVault.\nEvaluating contract idempotency and zero-downtime database schema migration."
    },
    debug: {
      badge: "🔬 DEBUG PERSONA",
      role: "Scientific Root-Cause Hunt",
      instruction: '"Hypothesize, isolate, reproduce, verify. Rejects guessing; instruments minimal repros and isolates offending state transitions."',
      sample: "☾ lunar ❯ Isolated memory leak to unclosed SQLite prepared statement in worker_pool.mjs:89.\nReproduction confirmed: RSS stabilizes under 32MB after explicit statement finalizer."
    },
    teach: {
      badge: "🎓 TEACH PERSONA",
      role: "Pedagogical Guide",
      instruction: '"Explains the underlying mechanisms, why specific patterns were chosen, and helps junior and senior developers deepen their mental models."',
      sample: "☾ lunar ❯ Here is why node:sqlite DatabaseSync prevents race conditions here:\nBy running synchronously on the worker loop, we avoid asynchronous lock contention."
    },
    plan: {
      badge: "🗺️ PLAN PERSONA",
      role: "Read-Only Blueprinting",
      instruction: '"Operates with write & bash tools strictly disabled. Formulates rigorous multi-phase flight plans and dependency graphs for team review."',
      sample: "☾ lunar ❯ Flight Plan Blueprint formulated (4 phases, 12 discrete milestones).\nAll target files verified. Ready for execution upon permission promotion."
    },
    review: {
      badge: "🔍 REVIEW PERSONA",
      role: "Findings-First Auditor",
      instruction: '"Rigorous security, performance, and correctness auditor. Ranks findings by severity (Critical / Warn / Style) with surgical code remediation."',
      sample: "☾ lunar ❯ AUDIT REPORT: 1 Critical (JWT unverified algorithm header), 2 Minor (Unused crypto import).\nPatch ready for review."
    }
  };

  const personaPills = document.querySelectorAll('.persona-pill');
  const pBadge = document.getElementById('pBadge');
  const pRole = document.getElementById('pRole');
  const pInstruction = document.getElementById('pInstruction');
  const pSample = document.getElementById('pSample');

  personaPills.forEach(pill => {
    pill.addEventListener('click', () => {
      personaPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const key = pill.getAttribute('data-persona');
      const data = PERSONAS[key];
      if (data && pBadge && pRole && pInstruction && pSample) {
        pBadge.textContent = data.badge;
        pRole.textContent = data.role;
        pInstruction.textContent = data.instruction;
        pSample.textContent = data.sample;
      }
    });
  });

  // ─── 7. KEYBOARD SHORTCUTS MODAL ──────────────────────────────────
  const shortcutsModal = document.getElementById('shortcutsModal');
  const openShortcutsBtn = document.getElementById('openShortcutsBtn');
  const closeShortcutsBtn = document.getElementById('closeShortcutsBtn');

  function openModal() {
    if (shortcutsModal) shortcutsModal.classList.add('active');
  }

  function closeModal() {
    if (shortcutsModal) shortcutsModal.classList.remove('active');
  }

  if (openShortcutsBtn) openShortcutsBtn.addEventListener('click', openModal);
  if (closeShortcutsBtn) closeShortcutsBtn.addEventListener('click', closeModal);
  if (shortcutsModal) {
    shortcutsModal.addEventListener('click', (e) => {
      if (e.target === shortcutsModal) closeModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      if (shortcutsModal.classList.contains('active')) closeModal();
      else openModal();
    } else if (e.key === 'Escape' && shortcutsModal && shortcutsModal.classList.contains('active')) {
      closeModal();
    }
  });

  // ─── 8. BACK TO TOP BUTTON ────────────────────────────────────────
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 450) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ─── 9. LIVE GITHUB STATS FETCHER ─────────────────────────────────
  const gitHubStarsEl = document.getElementById('gitHubStars');
  function fetchGitHubStats() {
    fetch('https://api.github.com/repos/ahpah-dev/Lunar-CLI')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.stargazers_count === 'number' && gitHubStarsEl) {
          gitHubStarsEl.textContent = `★ ${data.stargazers_count}`;
        }
      })
      .catch(() => {});
  }
  fetchGitHubStats();

  // ─── 10. COPY COMMAND & TOAST FEEDBACK ────────────────────────────
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

  // ─── 11. CONFIG GENERATOR LOGIC ───────────────────────────────────
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
  initMoonParallax();
  initSpotlightCards();
  playScenario('surgical-edit');

  setInterval(updateAstronomicalWidgets, 60000);
})();
