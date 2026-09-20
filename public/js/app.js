/**
 * AquaRoute Application Entry Point (Phase 6 Complete)
 * Wires Api, Pipeline, and Dashboard components together with full Tier 1, 2, and 3 interactivity.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize components
  Dashboard.init();
  Pipeline.init("pipeline-diagram");

  let isCompareMode = false;

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
