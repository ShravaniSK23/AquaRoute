/**
 * AquaRoute Dashboard Controller
 * Handles status strip, session telemetry totals, decision card, live resource meter, and trace rendering.
 */

const Dashboard = {
  // Session cumulative totals
  routedWaterTotal: 0,
  baselineWaterTotal: 0,
  requestCount: 0,

  init() {
    this.updateStatusStrip({ apiReachable: false, cacheActive: false });
    this.renderTotals();
  },

  /**
   * Update Status Indicators Header Strip
   */
  updateStatusStrip({ apiReachable, cacheActive }) {
    const apiDot = document.getElementById("status-api-dot");
    const apiText = document.getElementById("status-api-text");
    const cacheDot = document.getElementById("status-cache-dot");

    if (apiDot && apiText) {
      if (apiReachable) {
        apiDot.className = "status-dot online";
        apiText.textContent = "API Online";
      } else {
        apiDot.className = "status-dot offline";
        apiText.textContent = "API Offline";
      }
    }

    if (cacheDot) {
      if (cacheActive) {
        cacheDot.className = "status-dot online";
      } else {
        cacheDot.className = "status-dot offline";
      }
    }
  },

  /**
   * Render session cumulative metrics
   */
  renderTotals() {
    const routedEl = document.getElementById("metric-routed-total");
    const baselineEl = document.getElementById("metric-baseline-total");
    const savedPctEl = document.getElementById("metric-saved-pct");

    if (routedEl) {
      routedEl.textContent = `${this.routedWaterTotal.toFixed(3)} mL`;
    }

    if (this.baselineWaterTotal <= 0) {
      if (baselineEl) baselineEl.textContent = "—";
      if (savedPctEl) savedPctEl.textContent = "—";
      return;
    }

    if (baselineEl) {
      baselineEl.textContent = `${this.baselineWaterTotal.toFixed(3)} mL`;
    }

    const savedPct = Math.max(
      0,
      ((1 - this.routedWaterTotal / this.baselineWaterTotal) * 100)
    );

    if (savedPctEl) {
      savedPctEl.textContent = `${savedPct.toFixed(1)}%`;
    }
  },

  /**
   * Update totals with completed request payload
   */
  recordRequestData(data) {
    this.requestCount++;
    if (!data.cached) {
      const water = Number(data.resources?.waterMl) || 0;
      const baseline = Number(data.alwaysLarge?.waterMl) || 0;
      this.routedWaterTotal += water;
      this.baselineWaterTotal += baseline;
    }
    this.renderTotals();
  },

  /**
   * Render a response card with decision card, live meter, inline cache status, trace, and response text.
   */
  renderResponseCard(prompt, data) {
    const container = document.getElementById("response-container");
    if (!container) return;

    // Determine tag class and text
    const isCached = Boolean(data.cached);
    const tier = data.tier || "unknown";

    let tagClass = "unknown";
    let tagText = "Unknown Tier";

    if (isCached) {
      tagClass = "cached";
      tagText = "Cached";
    } else if (tier === "small") {
      tagClass = "small";
      tagText = "Small Model (Lite)";
    } else if (tier === "large") {
      tagClass = "large";
      tagText = "Large Model";
    }

    // Cache status badge
    const cacheStatusText = isCached
      ? "HIT → 0 new computation"
      : "MISS → COMPUTED";
    const cacheBadgeClass = isCached ? "hit" : "miss";

    // Telemetry values for live resource meter
    const waterMl = Number(data.resources?.waterMl) || 0;
    const energyWh = Number(data.resources?.energyWh) || 0;
    const tokens = Number(data.resources?.tokens) || Number(data.usage?.totalTokenCount) || 0;

    // Decision card info
    const signalText = data.signal || (isCached ? "Matched similarity threshold" : "Default routing rule");
    const routingReason = data.routingReason || "Routing executed per complexity score";

    // Markdown rendering safely
    let responseHtml = "";
    if (typeof window.marked !== "undefined" && window.marked.parse) {
      responseHtml = window.marked.parse(data.response || "");
    } else {
      responseHtml = `<p>${this.escapeHtml(data.response || "")}</p>`;
    }

    const cardHtml = `
      <div class="response-card">
        <div class="response-header">
          <div class="user-prompt-text">${this.escapeHtml(prompt)}</div>
          <div>
            <span class="tag ${tagClass}">${tagText}</span>
            <span class="cache-badge ${cacheBadgeClass}">${cacheStatusText}</span>
          </div>
        </div>

        <!-- Telemetry Row: Decision Card + Live Resource Meter -->
        <div class="telemetry-row">
          <!-- Model Decision Card -->
          <div class="decision-card">
            <div class="telemetry-title">Model Decision Signal</div>
            <div class="decision-signal">${this.escapeHtml(signalText)}</div>
            <div class="decision-reason">${this.escapeHtml(routingReason)}</div>
          </div>

          <!-- Live Resource Meter (Current Request) -->
          <div class="live-meter-card">
            <div class="telemetry-title">Live Resource Impact (Current Request)</div>
            <div class="live-meter-values">
              <div class="meter-item">
                ${waterMl.toFixed(4)} mL
                <span>Estimated Water</span>
              </div>
              <div class="meter-item">
                ${energyWh.toFixed(4)} Wh
                <span>Energy Consumed</span>
              </div>
              <div class="meter-item">
                ${tokens}
                <span>Tokens</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Response Content -->
        <div class="markdown-body">
          ${responseHtml}
        </div>

        <!-- Receipt Line -->
        <div class="receipt-line">
          <span>AquaRoute Telemetry Receipt</span>
          <span class="receipt-highlight">≈ ${waterMl.toFixed(4)} mL water impact | ${tokens} tokens</span>
        </div>

        <!-- "What just happened?" Expandable Trace -->
        <details class="trace-details">
          <summary>🔍 What just happened? (Expand full pipeline trace)</summary>
          <div class="trace-content">
            <div class="trace-item"><strong>Request ID:</strong> <code>${data.requestId || "N/A"}</code></div>
            <div class="trace-item"><strong>Routing Decision:</strong> ${this.escapeHtml(routingReason)}</div>
            <div class="trace-item"><strong>Triggering Signal:</strong> <code>${this.escapeHtml(signalText)}</code></div>
            <div class="trace-item"><strong>Cache Status:</strong> ${cacheStatusText}</div>
            <div class="trace-item"><strong>Model Selected:</strong> ${data.model || "None (Served from Cache)"}</div>
            <div class="trace-item"><strong>Token Count:</strong> ${tokens} total tokens</div>
            <div class="trace-item"><strong>Resource Math:</strong> ${isCached ? "0 mL (Cached)" : `${tokens} tokens × rate = ${waterMl.toFixed(4)} mL water, ${energyWh.toFixed(4)} Wh energy`}</div>
            ${data.alwaysLarge ? `<div class="trace-item"><strong>Hypothetical Baseline:</strong> ${Number(data.alwaysLarge.waterMl).toFixed(4)} mL water if routed to large tier</div>` : ""}
          </div>
        </details>
      </div>
    `;

    // Remove any loading placeholder
    this.removeLoadingCard();

    // Prepend new response card
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = cardHtml.trim();
    container.prepend(tempDiv.firstElementChild);
  },

  renderLoadingCard(prompt) {
    const container = document.getElementById("response-container");
    if (!container) return;

    this.removeLoadingCard();

    const loadingHtml = `
      <div class="response-card" id="loading-card" style="opacity: 0.7;">
        <div class="response-header">
          <div class="user-prompt-text">${this.escapeHtml(prompt)}</div>
          <span class="tag small" style="background: var(--surface-elevated); color: var(--accent-cyan);">Streaming Pipeline...</span>
        </div>
        <div style="font-family: var(--font-mono); font-size: 13px; color: var(--accent-cyan);">
          Processing prompt through SSE pipeline...
        </div>
      </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = loadingHtml.trim();
    container.prepend(tempDiv.firstElementChild);
  },

  removeLoadingCard() {
    const el = document.getElementById("loading-card");
    if (el) el.remove();
  },

  renderErrorCard(message) {
    this.removeLoadingCard();
    const container = document.getElementById("response-container");
    if (!container) return;

    const errorHtml = `
      <div class="response-card" style="border-color: var(--status-red);">
        <div class="response-header">
          <div class="user-prompt-text" style="color: var(--status-red);">Error Processing Request</div>
          <span class="tag large">Failed</span>
        </div>
        <div style="font-size: 14px; color: var(--text-primary);">
          ${this.escapeHtml(message)}
        </div>
      </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = errorHtml.trim();
    container.prepend(tempDiv.firstElementChild);
  },

  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
};

window.Dashboard = Dashboard;
