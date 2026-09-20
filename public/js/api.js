/**
 * AquaRoute API Client
 * Manages /health polling, SSE pipeline streaming, and Compare Mode.
 */

const Api = {
  /**
   * Poll backend health
   * @returns {Promise<{apiReachable: boolean, cacheActive: boolean}>}
   */
  async checkHealth() {
    try {
      const res = await fetch("/health");
      if (!res.ok) {
        return { apiReachable: false, cacheActive: false };
      }
      return await res.json();
    } catch (err) {
      console.error("[Health Check Failed]", err);
      return { apiReachable: false, cacheActive: false };
    }
  },

  /**
   * Submit prompt to POST /generate and stream pipeline stages via EventSource GET /generate/stream?id=<requestId>
   * @param {string} prompt 
   * @param {object} options 
   * @param {boolean} options.noCache 
   * @param {object} callbacks 
   * @param {function} callbacks.onStage 
   * @param {function} callbacks.onError 
   * @param {function} callbacks.onComplete 
   */
  async generateStream(prompt, options = {}, { onStage, onError, onComplete }) {
    try {
      // 1. Send POST request to receive unique requestId
      const postRes = await fetch("/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          noCache: Boolean(options.noCache)
        })
      });

      const postData = await postRes.json();

      if (!postRes.ok) {
        throw new Error(postData.error || `HTTP ${postRes.status}: Failed to initialize pipeline`);
      }

      const { requestId } = postData;
      if (!requestId) {
        throw new Error("Server returned no requestId");
      }

      console.log(`[AquaRoute] Initialized request ${requestId}. Opening SSE stream...`);

      // 2. Open EventSource stream connection to GET /generate/stream?id=<requestId>
      const streamUrl = `/generate/stream?id=${encodeURIComponent(requestId)}`;
      const eventSource = new EventSource(streamUrl);

      const stages = [
        "received",
        "classified",
        "cache_hit",
        "cache_miss",
        "model_call_start",
        "model_call_done",
        "estimated",
        "complete",
        "error"
      ];

      stages.forEach((stageName) => {
        eventSource.addEventListener(stageName, (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(`[AquaRoute Event: ${stageName}]`, data);

            if (stageName === "error") {
              eventSource.close();
              if (onError) onError(new Error(data.error || "Pipeline failed"));
              return;
            }

            if (stageName === "complete") {
              eventSource.close();
              if (onStage) onStage("complete", data);
              if (onComplete) onComplete(data.data);
              return;
            }

            if (onStage) {
              onStage(stageName, data);
            }
          } catch (e) {
            console.error(`[AquaRoute Parse Error on ${stageName}]`, e);
          }
        });
      });

      eventSource.onerror = (err) => {
        console.error("[AquaRoute SSE Stream Error]", err);
        eventSource.close();
        if (onError) onError(new Error("Connection to pipeline stream failed"));
      };

    } catch (err) {
      console.error("[AquaRoute generateStream Error]", err);
      if (onError) onError(err);
    }
  },

  /**
   * Submit prompt for Compare Mode (runs Small and Large model concurrently)
   * @param {string} prompt 
   * @returns {Promise<object>}
   */
  async compareModels(prompt) {
    const res = await fetch("/generate/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Compare Mode execution failed");
    }
    return data;
  }
};

window.Api = Api;
