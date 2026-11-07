(() => {
  if (window.__websiteTTSLoaded) return;
  window.__websiteTTSLoaded = true;

  let blocks = [];
  let rate = 1;
  let speaking = false;
  let finished = false;
  let runId = 0;
  const highlightClass = "website-tts-current";
  const isTopFrame = window === window.top;

  const status = (index = 0, total = blocks.length) => ({ speaking, finished, index, total });

  function clearHighlight() {
    document.querySelectorAll("." + highlightClass).forEach(el => el.classList.remove(highlightClass));
  }

  function collectTextBlocks() {
    const semanticSelector =
      "p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,dt,dd,td,th," +
      "[role='paragraph'],[role='listitem'],[data-testid*='paragraph'],[data-testid*='text']";
    const semantic = [...document.querySelectorAll(semanticSelector)];

    // Skilljar lesson text is often stored in nested divs. Collect text owned
    // by each div (including text inside inline spans), not only leaf divs.
    // Text inside a nested div is left for that nested div to collect.
    function directDivText(el) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          let parent = node.parentElement;
          while (parent && parent !== el) {
            if (parent.tagName === "DIV") return NodeFilter.FILTER_REJECT;
            parent = parent.parentElement;
          }
          return node.nodeValue.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      });
      const parts = [];
      let node;
      while ((node = walker.nextNode())) parts.push(node.nodeValue.trim());
      return parts.join(" ").replace(/\s+/g, " ").trim();
    }

    const candidates = semantic.map(element => ({
      element,
      text: element.innerText?.replace(/\s+/g, " ").trim()
    }));

    for (const element of document.querySelectorAll("div")) {
      // Semantic elements are collected separately. Avoid reading their text
      // again through a surrounding div.
      if (element.querySelector(semanticSelector)) continue;
      const text = directDivText(element);
      if (text.length >= 2) candidates.push({ element, text });
    }

    return candidates.filter(({ element, text }) => {
      const rect = element.getBoundingClientRect();
      if (!text || text.length < 2 || !rect.width || !rect.height ||
          element.closest("nav,header,footer,aside,[aria-hidden='true'],[hidden]")) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" ||
          style.visibility === "collapse") return false;
      return true;
    });
  }

  function splitText(text, maxLength = 2800) {
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]?/g) || [text];
    const chunks = [];
    let chunk = "";
    for (const sentence of sentences) {
      if (chunk && chunk.length + sentence.length > maxLength) {
        chunks.push(chunk.trim());
        chunk = "";
      }
      if (sentence.length > maxLength) {
        for (let offset = 0; offset < sentence.length; offset += maxLength) {
          if (chunk) { chunks.push(chunk.trim()); chunk = ""; }
          chunks.push(sentence.slice(offset, offset + maxLength).trim());
        }
      } else {
        chunk += sentence;
      }
    }
    if (chunk.trim()) chunks.push(chunk.trim());
    return chunks.filter(Boolean);
  }

  function stopLocal() {
    runId++;
    chrome.runtime.sendMessage({ type: "website-tts:stop" }).catch(() => {});
    speaking = false;
    clearHighlight();
  }

  function requestAudio(text, token) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "website-tts:synthesize", text, rate }, response => {
        const error = chrome.runtime.lastError;
        if (error) return reject(new Error(error.message));
        if (token !== runId) return reject(new Error("Playback stopped."));
        if (response?.error) return reject(new Error(response.error));
        if (!response?.audioBase64 || !response?.contentType)
          return reject(new Error("The TTS API returned an incomplete audio response."));
        resolve({ audioBase64: response.audioBase64, contentType: response.contentType });
      });
    });
  }

  function playAudio(payload, token) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: "website-tts:play",
        audioBase64: payload.audioBase64,
        contentType: payload.contentType
      }, response => {
        const error = chrome.runtime.lastError;
        if (error) return reject(new Error(error.message));
        if (token !== runId) return resolve();
        if (response?.error) return reject(new Error(response.error));
        resolve();
      });
    });
  }

  async function speakOne(localIndex) {
    if (!blocks.length) return { error: "No readable text found in this frame." };
    if (localIndex < 0 || localIndex >= blocks.length) return { ok: true };

    stopLocal();
    const token = runId;
    speaking = true;
    finished = false;
    const block = blocks[localIndex];
    const element = block.element;
    clearHighlight();
    element.classList.add(highlightClass);
    element.scrollIntoView({ behavior: "smooth", block: "center" });

    try {
      for (const chunk of splitText(block.text)) {
        if (token !== runId) return { stopped: true };
        const payload = await requestAudio(chunk, token);
        if (token !== runId) return { stopped: true };
        await playAudio(payload, token);
      }
      if (token !== runId) return { stopped: true };
      speaking = false;
      clearHighlight();
      return { ok: true };
    } catch (error) {
      if (token === runId) {
        speaking = false;
        clearHighlight();
        console.error("WebsiteTTS:", error);
      }
      return { error: error.message };
    }
  }

  const style = document.createElement("style");
  style.textContent = "." + highlightClass +
    "{outline:3px solid #f2c94c!important;outline-offset:4px!important;" +
    "background:rgba(255,230,120,.25)!important;border-radius:3px!important;" +
    "scroll-margin-top:100px!important}";
  (document.head || document.documentElement).appendChild(style);

  // Each frame exposes only its own text count and one-block playback operation.
  if (!isTopFrame) {
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
      if (message.command === "websiteTTS:collectFrame") {
        blocks = collectTextBlocks();
        reply({ count: blocks.length });
      } else if (message.command === "websiteTTS:speakFrameBlock") {
        rate = Number(message.rate) || rate;
        speakOne(message.index).then(reply);
      } else if (message.command === "websiteTTS:stopFrame") {
        stopLocal();
        reply({ ok: true });
      } else if (message.command === "websiteTTS:setFrameRate") {
        rate = Math.min(2, Math.max(0.7, Number(message.rate) || rate));
        reply({ ok: true });
      }
      return true;
    });
    return;
  }

  let frameBlocks = [];
  let globalIndex = 0;
  let activeFrameId = null;
  let controllerRun = 0;

  function sendBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        const error = chrome.runtime.lastError;
        if (error) return reject(new Error(error.message));
        if (response?.error) return reject(new Error(response.error));
        resolve(response);
      });
    });
  }

  async function collectAllFrames() {
    const result = await sendBackground({ type: "website-tts:collect-frames" });
    frameBlocks = result.frames || [];
    return frameBlocks.reduce((sum, frame) => sum + frame.count, 0);
  }

  async function stopAllFrames() {
    controllerRun++;
    if (activeFrameId !== null) {
      await sendBackground({
        type: "website-tts:frame-command",
        frameId: activeFrameId,
        command: "websiteTTS:stopFrame"
      }).catch(() => {});
    }
    await sendBackground({ type: "website-tts:stop-all-frames" }).catch(() => {});
    activeFrameId = null;
    speaking = false;
  }

  function locateGlobalIndex(target) {
    let offset = 0;
    for (const frame of frameBlocks) {
      if (target < offset + frame.count) return { frame, localIndex: target - offset };
      offset += frame.count;
    }
    return null;
  }

  async function playGlobal(target, token) {
    const total = frameBlocks.reduce((sum, frame) => sum + frame.count, 0);
    if (target < 0) target = 0;
    if (target >= total) {
      speaking = false;
      finished = true;
      activeFrameId = null;
      return { status: { speaking, finished, index: Math.max(0, total - 1), total } };
    }

    const located = locateGlobalIndex(target);
    if (!located) return { error: "Could not locate the selected lesson content." };
    globalIndex = target;
    activeFrameId = located.frame.frameId;
    speaking = true;
    finished = false;

    const result = await sendBackground({
      type: "website-tts:frame-command",
      frameId: located.frame.frameId,
      command: "websiteTTS:speakFrameBlock",
      index: located.localIndex,
      rate
    });
    if (token !== controllerRun) return { status: { speaking: false, finished: false, index: globalIndex, total } };
    if (result?.error) {
      speaking = false;
      return { error: result.error, status: { speaking, finished, index: globalIndex, total } };
    }
    if (target + 1 < total) return playGlobal(target + 1, token);

    speaking = false;
    finished = true;
    activeFrameId = null;
    return { status: { speaking, finished, index: globalIndex, total } };
  }

  async function handleCommand(message) {
    if (message.rate) {
      rate = Math.min(2, Math.max(0.7, Number(message.rate) || rate));
      await sendBackground({ type: "website-tts:set-frame-rate", rate }).catch(() => {});
    }

    if (message.command === "getStatus") {
      const total = frameBlocks.reduce((sum, frame) => sum + frame.count, 0);
      return { status: { speaking, finished, index: globalIndex, total } };
    }
    if (message.command === "setRate") {
      return { status: { speaking, finished, index: globalIndex, total: frameBlocks.reduce((sum, frame) => sum + frame.count, 0) } };
    }
    if (message.command === "stop") {
      await stopAllFrames();
      finished = false;
      return { status: { speaking, finished, index: globalIndex, total: frameBlocks.reduce((sum, frame) => sum + frame.count, 0) } };
    }

    if (message.command === "start") {
      await stopAllFrames();
      const token = controllerRun;
      const total = await collectAllFrames();
      // A Stop command can arrive while frame discovery is still pending.
      if (token !== controllerRun) {
        return { status: { speaking: false, finished: false, index: globalIndex, total } };
      }
      if (!total) return { error: "No readable text found on this page or its frames." };
      globalIndex = finished ? 0 : Math.min(globalIndex, total - 1);
      return playGlobal(globalIndex, token);
    }

    if (message.command === "forward" || message.command === "backward") {
      const discoveryToken = controllerRun;
      if (!frameBlocks.length) {
        const total = await collectAllFrames();
        if (discoveryToken !== controllerRun) {
          return { status: { speaking: false, finished: false, index: globalIndex, total } };
        }
        if (!total) return { error: "No readable text found on this page or its frames." };
      }
      await stopAllFrames();
      const next = message.command === "forward" ? globalIndex + 1 : Math.max(0, globalIndex - 1);
      return playGlobal(next, controllerRun);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.command === "websiteTTS:collectFrame") {
      blocks = collectTextBlocks();
      reply({ count: blocks.length });
      return;
    }
    if (message.command === "websiteTTS:speakFrameBlock") {
      rate = Math.min(2, Math.max(0.7, Number(message.rate) || rate));
      speakOne(message.index).then(reply);
      return true;
    }
    if (message.command === "websiteTTS:stopFrame") {
      stopLocal();
      reply({ ok: true });
      return;
    }
    if (message.command === "websiteTTS:setFrameRate") {
      rate = Math.min(2, Math.max(0.7, Number(message.rate) || rate));
      reply({ ok: true });
      return;
    }
    if (!["start", "stop", "forward", "backward", "setRate", "getStatus"].includes(message.command)) return;
    handleCommand(message).then(reply).catch(error => reply({ error: error.message || "Unable to read this page." }));
    return true;
  });
})();