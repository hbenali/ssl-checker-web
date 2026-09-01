document.addEventListener("DOMContentLoaded", function () {

  const checkForm = document.getElementById("checkForm");
  const feedback = document.getElementById("feedback");
  const results = document.getElementById("results");
  const certDetails = document.getElementById("certDetails");
  const chainRecommendation = document.getElementById("chainRecommendation");
  const hostnameInput = document.getElementById("hostname");
  const themeToggle = document.getElementById("themeToggle");

  // ---------- Theme ----------
  const THEME_KEY = "sslCheckerTheme";

  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function effectiveTheme() {
    const stored = getStoredTheme();
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme() {
    const stored = getStoredTheme();
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    if (themeToggle) themeToggle.textContent = effectiveTheme() === "dark" ? "☀️" : "🌙";
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = effectiveTheme() === "dark" ? "light" : "dark";
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      applyTheme();
    });
  }

  applyTheme();

  // ---------- Session ----------
  function getSessionId() {

    let sessionId = localStorage.getItem("sslCheckerSession");

    if (!sessionId) {
      sessionId = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem("sslCheckerSession", sessionId);
    }

    return sessionId;
  }

  const sessionId = getSessionId();

  function extractHostname(input) {

    try {

      if (!input.startsWith("http://") && !input.startsWith("https://")) {
        input = "https://" + input;
      }

      const url = new URL(input);

      let host = url.hostname;

      if (url.port) {
        host += ":" + url.port;
      }

      return host;

    } catch {

      return input
        .replace(/^https?:\/\//, "")
        .split("/")[0];

    }
  }

  function getQueryParam(param) {
    return new URLSearchParams(window.location.search).get(param);
  }

  function normalizeInput() {

    const raw = hostnameInput.value.trim();

    if (!raw) return;

    hostnameInput.value = extractHostname(raw);

  }

  hostnameInput.addEventListener("blur", normalizeInput);

  hostnameInput.addEventListener("paste", function () {
    setTimeout(normalizeInput, 0);
  });

  const hostParam = getQueryParam("host");

  if (hostParam) {

    const normalized = extractHostname(hostParam);

    hostnameInput.value = normalized;

    checkCertificate(normalized);

  }

  checkForm.addEventListener("submit", function (e) {

    e.preventDefault();

    const rawInput = hostnameInput.value.trim();

    if (!rawInput) return;

    const hostname = extractHostname(rawInput);

    hostnameInput.value = hostname;

    checkCertificate(hostname);

  });

  // shows a small transient inline confirmation instead of a blocking alert()
  function flashInlineFeedback(container, message) {
    let note = container.querySelector(".inline-feedback");
    if (!note) {
      note = document.createElement("p");
      note.className = "inline-feedback";
      note.setAttribute("role", "status");
      container.appendChild(note);
    }
    note.textContent = message;
    clearTimeout(note._hideTimer);
    note._hideTimer = setTimeout(() => { note.textContent = ""; }, 2500);
  }

  async function checkCertificate(hostname) {

    feedback.textContent = `Checking certificate chain for ${hostname}...`;
    feedback.classList.remove("hidden");

    results.classList.add("hidden");

    certDetails.innerHTML = "";

    if (chainRecommendation) {
      chainRecommendation.classList.add("hidden");
      chainRecommendation.innerHTML = "";
    }

    try {

      const apiUrl =
        `https://web.api.sslmate.com/whatsmychaincert/evaluate` +
        `?host=${encodeURIComponent(hostname)}` +
        `&session_id=${sessionId}` +
        `&referrer=${encodeURIComponent(window.location.origin)}`;

      const res = await fetch(apiUrl);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (!data.results || !data.results.length) {
        throw new Error("No certificate results returned for this host");
      }

      const result = data.results[0];

      const trusted = result.trusted && !result.leaf_expired;

      certDetails.innerHTML = `
        <h3>${escapeHtml(hostname)}</h3>
        <p>Status:
          <span class="badge ${trusted ? "trusted" : "untrusted"}">
            ${trusted ? "Trusted" : "Untrusted"}
          </span>
        </p>
        ${result.leaf_expired ? '<p class="badge untrusted">Expired</p>' : ""}
        <button id="shareLinkBtn" class="copy-btn" type="button">Share Link</button>
      `;

      const shareBtn = document.getElementById("shareLinkBtn");

      if (shareBtn) {

        shareBtn.addEventListener("click", async function () {

          const shareUrl =
            window.location.origin +
            window.location.pathname +
            "?host=" +
            encodeURIComponent(hostname);

          try {
            await navigator.clipboard.writeText(shareUrl);
            flashInlineFeedback(certDetails, "Shareable link copied to clipboard!");
          } catch (e) {
            flashInlineFeedback(certDetails, "Couldn't copy automatically — copy it manually: " + shareUrl);
          }

        });

      }

      if (!trusted && chainRecommendation) {

        chainRecommendation.innerHTML = `
          <h3>Recommended Certificate Chain</h3>
          <textarea readonly>${escapeHtml(result.better_chain || "")}</textarea>
          <div class="btn-row">
            <button class="copy-btn" id="copyChainBtn" type="button">Copy Chain</button>
            <button class="copy-btn" id="downloadChainBtn" type="button">Download Full Chain (.pem)</button>
          </div>
        `;

        chainRecommendation.classList.remove("hidden");

        const copyBtn = document.getElementById("copyChainBtn");

        if (copyBtn) {

          copyBtn.addEventListener("click", async function () {

            const textarea = chainRecommendation.querySelector("textarea");

            try {
              await navigator.clipboard.writeText(textarea.value);
              flashInlineFeedback(chainRecommendation, "Certificate chain copied!");
            } catch (e) {
              textarea.select();
              flashInlineFeedback(chainRecommendation, "Couldn't copy automatically — text is selected, press Ctrl/Cmd+C.");
            }

          });

        }

        const downloadBtn = document.getElementById("downloadChainBtn");

        if (downloadBtn) {

          downloadBtn.addEventListener("click", function () {

            const chainText = chainRecommendation.querySelector("textarea").value;
            const baseName = (result.filename || hostname).replace(/[^a-zA-Z0-9._-]/g, "_");
            const filename = baseName + "-full-chain.pem";

            const blob = new Blob([chainText], { type: "application/x-pem-file" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();

            URL.revokeObjectURL(url);

            flashInlineFeedback(chainRecommendation, `Downloaded as ${filename}`);

          });

        }

      }

      results.classList.remove("hidden");

    } catch (err) {

      results.classList.remove("hidden");

      certDetails.innerHTML = `<p style="color:var(--untrusted);">Error: ${escapeHtml(err.message)}</p>`;

      if (chainRecommendation) {
        chainRecommendation.innerHTML = "";
      }

    } finally {

      feedback.classList.add("hidden");

    }

  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"]/g, function (m) {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      if (m === '"') return "&quot;";
      return m;
    });
  }

});
