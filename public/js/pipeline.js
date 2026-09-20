/**
 * AquaRoute Pipeline Diagram Component
 * Visualizes the 6 real-time backend execution stages driven by SSE events.
 */

const Pipeline = {
  containerEl: null,

  init(containerId) {
    this.containerEl = document.getElementById(containerId);
    this.reset();
  },

  reset() {
    if (!this.containerEl) return;

    this.containerEl.innerHTML = `
      <div class="pipeline-stage" id="stage-received">
        <div class="stage-name">1. Received</div>
        <div class="stage-status">Idle</div>
      </div>
      <div class="pipeline-connector">→</div>
      <div class="pipeline-stage" id="stage-classified">
        <div class="stage-name">2. Classifier</div>
        <div class="stage-status">Pending</div>
      </div>
      <div class="pipeline-connector">→</div>
      <div class="pipeline-stage" id="stage-cache">
        <div class="stage-name">3. Cache Check</div>
        <div class="stage-status">Pending</div>
      </div>
      <div class="pipeline-connector">→</div>
      <div class="pipeline-stage" id="stage-model">
        <div class="stage-name">4. Model Call</div>
        <div class="stage-status">Pending</div>
      </div>
      <div class="pipeline-connector">→</div>
      <div class="pipeline-stage" id="stage-estimate">
        <div class="stage-name">5. Estimator</div>
        <div class="stage-status">Pending</div>
      </div>
      <div class="pipeline-connector">→</div>
      <div class="pipeline-stage" id="stage-complete">
        <div class="stage-name">6. Complete</div>
        <div class="stage-status">Pending</div>
      </div>
    `;
  },

  /**
   * React to real backend SSE stage event
   * @param {string} stage 
   * @param {object} payload 
   */
  update(stage, payload) {
    const setStageState = (stageId, statusText, isActive, isCompleted) => {
      const el = document.getElementById(stageId);
      if (!el) return;
      el.classList.remove("active", "completed");
      if (isActive) el.classList.add("active");
      if (isCompleted) el.classList.add("completed");
      const statusEl = el.querySelector(".stage-status");
      if (statusEl && statusText) statusEl.textContent = statusText;
    };

    switch (stage) {
      case "received":
        this.reset();
        setStageState("stage-received", "Received", true, false);
        break;

      case "classified":
        setStageState("stage-received", "✓ Received", false, true);
        const tierLabel = payload.tier ? payload.tier.toUpperCase() : "CLASSIFIED";
        setStageState("stage-classified", `✓ ${tierLabel}`, true, false);
        break;

      case "cache_hit":
        setStageState("stage-classified", "✓ Classified", false, true);
        setStageState("stage-cache", "★ CACHE HIT", true, true);
        // Skip model and estimate for cache hit
        setStageState("stage-model", "Skipped (Cached)", false, true);
        setStageState("stage-estimate", "0 computation", false, true);
        break;

      case "cache_miss":
        setStageState("stage-classified", "✓ Classified", false, true);
        setStageState("stage-cache", "MISS → COMPUTED", true, false);
        break;

      case "model_call_start":
        setStageState("stage-cache", "✓ Cache Miss", false, true);
        const modelName = payload.tier === "small" ? "Gemini Flash Lite" : "Gemini Flash";
        setStageState("stage-model", `Calling ${modelName}...`, true, false);
        break;

      case "model_call_done":
        setStageState("stage-model", `✓ ${payload.totalTokens || 0} tokens`, true, true);
        break;

      case "estimated":
        setStageState("stage-model", "✓ Executed", false, true);
        setStageState("stage-estimate", `✓ ${payload.resources?.waterMl || 0} mL`, true, true);
        break;

      case "complete":
        setStageState("stage-received", "✓ Done", false, true);
        setStageState("stage-classified", "✓ Done", false, true);
        setStageState("stage-cache", "✓ Done", false, true);
        setStageState("stage-model", "✓ Done", false, true);
        setStageState("stage-estimate", "✓ Done", false, true);
        setStageState("stage-complete", "✓ Stream Closed", false, true);
        break;
    }
  }
};

window.Pipeline = Pipeline;
