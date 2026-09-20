/**
 * AquaRoute Application Entry Point (Phase 6 Complete)
 * Wires Api, Pipeline, and Dashboard components together with full Tier 1, 2, and 3 interactivity.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize components
  Dashboard.init();
  Pipeline.init("pipeline-diagram");

  let isCompareMode = false;

  // =========================================
  // SPA View Routing & Navigation Controller
  // =========================================
  const views = {
    overview: document.getElementById("view-overview"),
    routing: document.getElementById("view-routing"),
    trace: document.getElementById("view-trace"),
    water: document.getElementById("view-water")
  };

  const navLinks = {
    overview: document.getElementById("nav-overview"),
    routing: document.getElementById("nav-routing"),
    trace: document.getElementById("nav-trace"),
    water: document.getElementById("nav-water")
  };

  const breadcrumbEl = document.getElementById("header-breadcrumb");

  const viewTitles = {
    overview: "Overview",
    routing: "Routing Engine",
    trace: "Trace Stream",
    water: "Water Impact Matrix"
  };

  function switchView(target) {
    if (!views[target]) target = "overview";

    Object.keys(views).forEach((key) => {
      if (views[key]) {
        views[key].classList.toggle("active", key === target);
      }
      if (navLinks[key]) {
        navLinks[key].classList.toggle("active", key === target);
      }
    });

    if (breadcrumbEl && viewTitles[target]) {
      breadcrumbEl.textContent = viewTitles[target];
    }

    const scrollable = document.querySelector(".dashboard-scrollable");
    if (scrollable) scrollable.scrollTop = 0;

    if (window.location.hash !== `#${target}`) {
      try {
        history.replaceState(null, "", `#${target}`);
      } catch (e) {}
    }
  }

  // Expose globally for buttons and dashboard.js
  window.AquaRoute = window.AquaRoute || {};
  window.AquaRoute.switchView = switchView;

  // Bind Sidebar Nav Links
  Object.keys(navLinks).forEach((key) => {
    const link = navLinks[key];
    if (link) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        switchView(key);
      });
    }
  });

  // Bind any elements with data-nav attribute (e.g. hub cards or in-page buttons)
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-nav]");
    if (target) {
      const viewKey = target.getAttribute("data-nav");
      if (viewKey) {
        e.preventDefault();
        switchView(viewKey);
      }
    }
  });

  // Handle browser back/forward
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (views[hash]) {
      switchView(hash);
    }
  });

  // Set initial view from URL hash if valid, otherwise default to overview
  const initialHash = window.location.hash.replace("#", "").toLowerCase();
  if (views[initialHash]) {
    switchView(initialHash);
  } else {
    switchView("overview");
  }

  // Health check polling loop (every 10 seconds)
  const pollHealth = async () => {
    const health = await Api.checkHealth();
    Dashboard.updateStatusStrip(health);
  };

  pollHealth();
  setInterval(pollHealth, 10000);

  // UI Element References
  const promptInput = document.getElementById("prompt-input");
  const sendBtn = document.getElementById("send-btn");
  const compareBtn = document.getElementById("compare-btn");
  const resetBtn = document.getElementById("reset-btn");
  const exportBtn = document.getElementById("export-btn");
  const cacheToggle = document.getElementById("setting-cache-toggle");
  const waterUnitSelect = document.getElementById("setting-water-unit");
  const energyUnitSelect = document.getElementById("setting-energy-unit");

  // Form Submission Logic
  const handleSubmit = async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Switch to routing view immediately so user sees live pipeline and response
    switchView("routing");

    // Lock UI during active request
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<span>Executing...</span>`;
    
    Dashboard.renderLoadingCard(prompt);

    if (isCompareMode) {
      try {
        const compareData = await Api.compareModels(prompt);
        Dashboard.renderCompareCards(prompt, compareData);
      } catch (err) {
        Dashboard.renderErrorCard(err.message || "Compare Mode error");
      } finally {
        promptInput.value = "";
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<span>Send</span>`;
      }
      return;
    }

    // Standard SSE Stream execution
    Pipeline.reset();

    await Api.generateStream(prompt, { noCache: !Dashboard.cacheEnabled }, {
      onStage: (stage, data) => {
        Pipeline.update(stage, data);
      },
      onError: (err) => {
        Dashboard.renderErrorCard(err.message || "Pipeline execution error");
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<span>Send</span>`;
      },
      onComplete: (data) => {
        Dashboard.renderResponseCard(prompt, data);
        Dashboard.recordRequestData(prompt, data);
        
        // Clear input and unlock button
        promptInput.value = "";
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<span>Send</span>`;

        // Sync Earth Forward micro-impact indicator
        const savedPctEl = document.getElementById("metric-saved-pct");
        const impactText = document.getElementById("earth-forward-text");
        if (savedPctEl && impactText) {
          const val = savedPctEl.textContent.trim();
          if (val && val !== "0.0%" && val !== "—") {
            impactText.innerHTML = `<strong id="earth-reduction-pct">${val} reduction</strong> = Equivalent to saving ~3 drops of server cooling water &amp; 2.4 min of LED power per query.`;
          }
        }
      }
    });
  };

  // Event Listeners
  if (sendBtn) {
    sendBtn.addEventListener("click", handleSubmit);
  }

  if (promptInput) {
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) handleSubmit();
      }
    });
  }

  // Bind Demo Prompt Chips
  const chipButtons = document.querySelectorAll(".chip[data-prompt]");
  chipButtons.forEach((chip) => {
    chip.addEventListener("click", () => {
      const text = chip.getAttribute("data-prompt");
      if (text && promptInput) {
        promptInput.value = text;
        switchView("routing");
        promptInput.focus();
      }
    });
  });

  // Compare Mode Toggle
  if (compareBtn) {
    compareBtn.addEventListener("click", () => {
      isCompareMode = !isCompareMode;
      compareBtn.classList.toggle("active", isCompareMode);
      compareBtn.textContent = isCompareMode ? "Compare Mode ON" : "Compare Mode";
    });
  }

  // Reset Session
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset current session telemetry and clear timeline?")) {
        Dashboard.resetSession();
        const savedPctEl = document.getElementById("metric-saved-pct");
        const baselineEl = document.getElementById("metric-baseline-total");
        const impactText = document.getElementById("earth-forward-text");
        if (savedPctEl) savedPctEl.textContent = "0.0%";
        if (baselineEl) baselineEl.textContent = "0.0000 mL";
        if (impactText) {
          impactText.innerHTML = `<strong id="earth-reduction-pct">0.0% reduction</strong> = Awaiting queries to measure server cooling water &amp; LED power savings.`;
        }
      }
    });
  }

  // Export Session
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      Dashboard.exportSession();
    });
  }

  // Cache Setting Toggle
  if (cacheToggle) {
    cacheToggle.addEventListener("change", (e) => {
      Dashboard.cacheEnabled = e.target.checked;
      pollHealth();
    });
  }

  // Unit Switchers
  if (waterUnitSelect) {
    waterUnitSelect.addEventListener("change", (e) => {
      Dashboard.waterUnit = e.target.value;
      Dashboard.renderTotals();
      Dashboard.renderTimeline();
    });
  }

  if (energyUnitSelect) {
    energyUnitSelect.addEventListener("change", (e) => {
      Dashboard.energyUnit = e.target.value;
      Dashboard.renderTotals();
    });
  }
});
