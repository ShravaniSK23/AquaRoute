/**
 * AquaRoute Application Entry Point
 * Wires Api, Pipeline, and Dashboard components together.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize components
  Dashboard.init();
  Pipeline.init("pipeline-diagram");

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

  // Form Submission Logic
  const handleSubmit = async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Lock UI during active request
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<span>Streaming...</span>`;
    
    // Setup Pipeline & Loading state
    Pipeline.reset();
    Dashboard.renderLoadingCard(prompt);

    // Call API generateStream with SSE handlers
    await Api.generateStream(prompt, {
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
        Dashboard.recordRequestData(data);
        
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
});
