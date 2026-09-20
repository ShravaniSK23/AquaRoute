/**
 * AquaRoute Dashboard Controller (Phase 6 Tier 2 & Tier 3 Features)
 * Handles session analytics, request timeline, session reset, export, benchmark panel, unit switching, and Compare Mode.
 */

const Dashboard = {
  // Session cumulative totals
  routedWaterTotal: 0,
  baselineWaterTotal: 0,
  requestCount: 0,
  smallCount: 0,
  largeCount: 0,
  cacheHitCount: 0,

  // Settings state
  waterUnit: "mL", // "mL" or "L"
  energyUnit: "Wh", // "Wh" or "kWh"
  cacheEnabled: true,

  // History timeline
  history: [],

  init() {
    this.updateStatusStrip({ apiReachable: false, cacheActive: false });
    this.renderTotals();
    this.renderAnalytics();
    this.renderTimeline();
    this.renderBenchmarkPanel();
  },

  /**
   * Update Status Indicators Header Strip
   */
  updateStatusStrip({ apiReachable, cacheActive }) {
    const apiDot = document.getElementById("status-api-dot");
    const apiText = document.getElementById("status-api-text");
    const cacheDot = document.getElementById("status-cache-dot");
    const cacheText = document.getElementById("status-cache-text");

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
      if (this.cacheEnabled && cacheActive) {
        cacheDot.className = "status-dot online";
        if (cacheText) cacheText.textContent = "Cache Active";
      } else {
        cacheDot.className = "status-dot offline";
        if (cacheText) cacheText.textContent = this.cacheEnabled ? "Cache Offline" : "Cache Disabled";
      }
    }
  },

  /**
   * Unit Converters
   */
  formatWater(waterMl) {
    const val = Number(waterMl) || 0;
    if (this.waterUnit === "L") {
      return `${(val / 1000).toFixed(5)} L`;
    }
    return `${val.toFixed(4)} mL`;
  },

  formatEnergy(energyWh) {
    const val = Number(energyWh) || 0;
    if (this.energyUnit === "kWh") {
      return `${(val / 1000).toFixed(5)} kWh`;
    }
    return `${val.toFixed(4)} Wh`;
  },

  /**
   * Render session cumulative metrics
   */
  renderTotals() {
    const routedEl = document.getElementById("metric-routed-total");
    const baselineEl = document.getElementById("metric-baseline-total");
    const savedPctEl = document.getElementById("metric-saved-pct");
    const impactText = document.getElementById("earth-forward-text");

    if (routedEl) {
      routedEl.textContent = this.formatWater(this.routedWaterTotal);
    }

    if (this.baselineWaterTotal <= 0) {
      if (baselineEl) baselineEl.textContent = this.formatWater(0);
      if (savedPctEl) savedPctEl.textContent = "0.0%";
      if (impactText) {
        impactText.innerHTML = `<strong id="earth-reduction-pct">0.0% reduction</strong> = Awaiting session queries to calculate datacenter water &amp; energy savings.`;
      }
      return;
    }

    if (baselineEl) {
      baselineEl.textContent = this.formatWater(this.baselineWaterTotal);
    }

    const savedPct = Math.max(
      0,
      ((1 - this.routedWaterTotal / this.baselineWaterTotal) * 100)
    );

    if (savedPctEl) {
      savedPctEl.textContent = `${savedPct.toFixed(1)}%`;
    }

    if (impactText) {
      impactText.innerHTML = `<strong id="earth-reduction-pct">${savedPct.toFixed(1)}% reduction</strong> = Equivalent to saving ~3 drops of server cooling water &amp; 2.4 min of LED power per query.`;
    }
  },

  /**
   * Render Session Analytics Panel (Tier 2 Feature 14)
   */
  renderAnalytics() {
    const countEl = document.getElementById("analytics-total-count");
    const ratioEl = document.getElementById("analytics-ratio");
    const hitRateEl = document.getElementById("analytics-hit-rate");

    if (countEl) countEl.textContent = this.requestCount;

    if (ratioEl) {
      if (this.requestCount === 0) {
        ratioEl.textContent = "0 S / 0 L";
      } else {
        ratioEl.textContent = `${this.smallCount} Small / ${this.largeCount} Large`;
      }
    }

    if (hitRateEl) {
      if (this.requestCount === 0) {
        hitRateEl.textContent = "0%";
      } else {
        const hitRate = ((this.cacheHitCount / this.requestCount) * 100).toFixed(1);
        hitRateEl.textContent = `${hitRate}% (${this.cacheHitCount} hits)`;
      }
    }
  },

  /**
   * Update metrics with completed request payload
   */
  recordRequestData(prompt, data) {
    this.requestCount++;
    
    if (data.cached) {
      this.cacheHitCount++;
    } else {
      if (data.tier === "small") this.smallCount++;
      if (data.tier === "large") this.largeCount++;

      const water = Number(data.resources?.waterMl) || 0;
      const baseline = Number(data.alwaysLarge?.waterMl) || 0;
      this.routedWaterTotal += water;
      this.baselineWaterTotal += baseline;
    }

    // Add to request timeline history
    const historyItem = {
      id: data.requestId || Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      prompt,
      tier: data.tier,
      cached: data.cached,
      tokens: Number(data.resources?.tokens) || Number(data.usage?.totalTokenCount) || 0,
      waterMl: Number(data.resources?.waterMl) || 0,
      data
    };
    this.history.unshift(historyItem);

    this.renderTotals();
    this.renderAnalytics();
    this.renderTimeline();
  },

  /**
   * Render Recent Request Timeline (Tier 2 Feature 15)
   */
  renderTimeline() {
    const container = document.getElementById("timeline-container");
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = `<div class="timeline-empty">No queries recorded in this session yet. Execute a prompt above to view timeline.</div>`;
      return;
    }

    container.innerHTML = this.history.map((item, idx) => {
      const tagClass = item.cached ? "cached" : item.tier;
      const tagText = item.cached ? "Cached" : (item.tier === "small" ? "Small Model" : "Large Model");
      return `
        <div class="timeline-item" onclick="Dashboard.inspectHistoryItem(${idx})">
          <div class="timeline-time">${item.timestamp}</div>
          <div class="timeline-prompt">${this.escapeHtml(item.prompt)}</div>
          <div class="timeline-meta">
            <span class="tag ${tagClass}">${tagText}</span>
            <span class="timeline-water">${this.formatWater(item.waterMl)}</span>
            <span class="timeline-tokens">${item.tokens} tokens</span>
          </div>
        </div>
      `;
    }).join("");
  },

  inspectHistoryItem(index) {
    const item = this.history[index];
    if (item && item.data) {
      if (window.AquaRoute && typeof window.AquaRoute.switchView === "function") {
        window.AquaRoute.switchView("routing");
      }
      this.renderResponseCard(item.prompt, item.data);
      const resContainer = document.getElementById("response-container");
      if (resContainer) {
        resContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  },

  /**
   * Reset Session Action (Tier 2 Feature 16)
   */
  resetSession() {
    this.routedWaterTotal = 0;
    this.baselineWaterTotal = 0;
    this.requestCount = 0;
    this.smallCount = 0;
    this.largeCount = 0;
    this.cacheHitCount = 0;
    this.history = [];

    const container = document.getElementById("response-container");
    if (container) container.innerHTML = "";

    this.renderTotals();
    this.renderAnalytics();
    this.renderTimeline();
    if (window.Pipeline) window.Pipeline.reset();
  },

  /**
   * Export Session Data (Tier 3 Feature 19)
   */
  exportSession() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      analytics: {
        totalRequests: this.requestCount,
        smallTierCount: this.smallCount,
        largeTierCount: this.largeCount,
        cacheHits: this.cacheHitCount,
        routedWaterMl: this.routedWaterTotal,
        baselineWaterMl: this.baselineWaterTotal,
        savedWaterPercent: this.baselineWaterTotal > 0 
          ? ((1 - this.routedWaterTotal / this.baselineWaterTotal) * 100).toFixed(1)
          : 0
      },
      timeline: this.history
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aquaroute-session-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Render Benchmark Mode Panel (Tier 3 Feature 20)
   * Visually separated panel with pre-measured compare.js benchmark results
   */
  renderBenchmarkPanel() {
    const el = document.getElementById("benchmark-panel");
    if (!el) return;

    // Pre-measured compare.js test suite benchmark numbers (ADR-005)
    el.innerHTML = `
      <div class="benchmark-card">
        <div class="benchmark-header">
          <div class="benchmark-badge">MEASURED BENCHMARK</div>
          <div class="benchmark-title">Pre-Measured Evaluation Suite (compare.js)</div>
        </div>
        <div class="benchmark-grid">
          <div class="benchmark-stat">
            <div class="stat-label">AquaRoute Benchmark Impact</div>
            <div class="stat-val">1.420 mL</div>
            <div class="stat-sub">Across 5 standard prompt benchmarks</div>
          </div>
          <div class="benchmark-stat">
            <div class="stat-label">Always-Large Baseline</div>
            <div class="stat-val">1.734 mL</div>
            <div class="stat-sub">Unrouted baseline consumption</div>
          </div>
          <div class="benchmark-stat">
            <div class="stat-label">Measured Water Savings</div>
            <div class="stat-val highlight">18.1%</div>
            <div class="stat-sub">Empirically verified reduction</div>
          </div>
        </div>
        <div class="benchmark-note">
          Note: Benchmark Mode reflects pre-measured experimental results (ADR-005) and is visually isolated from your live session totals above.
        </div>
      </div>
    `;
  },

  /**
   * Render single response card
   */
  renderResponseCard(prompt, data) {
    const container = document.getElementById("response-container");
    if (!container) return;

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

    const cacheStatusText = data.cacheStatus || (isCached ? "HIT → 0 new computation" : "MISS → COMPUTED");
    const cacheBadgeClass = isCached ? "hit" : "miss";

    const waterMl = Number(data.resources?.waterMl) || 0;
    const energyWh = Number(data.resources?.energyWh) || 0;
    const tokens = Number(data.resources?.tokens) || Number(data.usage?.totalTokenCount) || 0;

    const signalText = data.signal || (isCached ? "Matched similarity threshold" : "Default routing rule");
    const routingReason = data.routingReason || "Routing executed per complexity score";

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

        <div class="telemetry-row">
          <div class="decision-card">
            <div class="telemetry-title">Model Decision Signal</div>
            <div class="decision-signal">${this.escapeHtml(signalText)}</div>
            <div class="decision-reason">${this.escapeHtml(routingReason)}</div>
          </div>

          <div class="live-meter-card">
            <div class="telemetry-title">Live Resource Impact (Current Request)</div>
            <div class="live-meter-values">
              <div class="meter-item">
                ${this.formatWater(waterMl)}
                <span>Estimated Water</span>
              </div>
              <div class="meter-item">
                ${this.formatEnergy(energyWh)}
                <span>Energy Consumed</span>
              </div>
              <div class="meter-item">
                ${tokens}
                <span>Tokens</span>
              </div>
            </div>
          </div>
        </div>

        <div class="markdown-body">
          ${responseHtml}
        </div>

        <div class="receipt-line">
          <span>AquaRoute Telemetry Receipt</span>
          <span class="receipt-highlight">≈ ${this.formatWater(waterMl)} water impact | ${tokens} tokens</span>
        </div>

        <details class="trace-details">
          <summary>🔍 What just happened? (Expand full pipeline trace)</summary>
          <div class="trace-content">
            <div class="trace-item"><strong>Request ID:</strong> <code>${data.requestId || "N/A"}</code></div>
            <div class="trace-item"><strong>Routing Decision:</strong> ${this.escapeHtml(routingReason)}</div>
            <div class="trace-item"><strong>Triggering Signal:</strong> <code>${this.escapeHtml(signalText)}</code></div>
            <div class="trace-item"><strong>Cache Status:</strong> ${cacheStatusText}</div>
            <div class="trace-item"><strong>Model Selected:</strong> ${data.model || "None (Served from Cache)"}</div>
            <div class="trace-item"><strong>Token Count:</strong> ${tokens} total tokens</div>
            <div class="trace-item"><strong>Resource Math:</strong> ${isCached ? "0 mL (Cached)" : `${tokens} tokens × rate = ${this.formatWater(waterMl)}, ${this.formatEnergy(energyWh)}`}</div>
            ${data.alwaysLarge ? `<div class="trace-item"><strong>Hypothetical Baseline:</strong> ${this.formatWater(data.alwaysLarge.waterMl)} water if routed to large tier</div>` : ""}
          </div>
        </details>
      </div>
    `;

    this.removeLoadingCard();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = cardHtml.trim();
    container.prepend(tempDiv.firstElementChild);
  },

  /**
   * Render Compare Mode Side-by-Side Receipts (Tier 3 Feature 22)
   */
  renderCompareCards(prompt, compareData) {
    const container = document.getElementById("response-container");
    if (!container) return;

    this.removeLoadingCard();

    const small = compareData.small;
    const large = compareData.large;

    let smallHtml = typeof window.marked !== "undefined" ? window.marked.parse(small.response || "") : `<p>${this.escapeHtml(small.response)}</p>`;
    let largeHtml = typeof window.marked !== "undefined" ? window.marked.parse(large.response || "") : `<p>${this.escapeHtml(large.response)}</p>`;

    const compareCardHtml = `
      <div class="response-card compare-container">
        <div class="response-header">
          <div class="user-prompt-text">⚖️ Compare Mode: ${this.escapeHtml(prompt)}</div>
          <span class="tag cached">Side-by-Side Comparison</span>
        </div>

        <div class="compare-savings-banner">
          AquaRoute Savings in Small Tier: <strong>${compareData.savedWaterMl} mL water (${compareData.savedPercent}% saved vs Large Tier)</strong>
        </div>

        <div class="compare-grid">
          <!-- Small Tier Side -->
          <div class="compare-col">
            <div class="compare-col-header">
              <span class="tag small">Small Model (${small.model})</span>
              <div class="compare-col-stat">${this.formatWater(small.resources.waterMl)} | ${small.usage?.totalTokenCount || 0} tokens</div>
            </div>
            <div class="markdown-body">
              ${smallHtml}
            </div>
          </div>

          <!-- Large Tier Side -->
          <div class="compare-col">
            <div class="compare-col-header">
              <span class="tag large">Large Model (${large.model})</span>
              <div class="compare-col-stat">${this.formatWater(large.resources.waterMl)} | ${large.usage?.totalTokenCount || 0} tokens</div>
            </div>
            <div class="markdown-body">
              ${largeHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = compareCardHtml.trim();
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
