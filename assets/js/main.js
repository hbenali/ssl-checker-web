document.addEventListener("DOMContentLoaded", function () {

  const checkForm = document.getElementById("checkForm");
  const feedback = document.getElementById("feedback");
  const results = document.getElementById("results");
  const certDetails = document.getElementById("certDetails");
  const chainRecommendation = document.getElementById("chainRecommendation");
  const hostnameInput = document.getElementById("hostname");

  const tabDomain = document.getElementById("tabDomain");
  const tabCert = document.getElementById("tabCert");
  const checkerSection = document.getElementById("checker");
  const resultsSection = document.getElementById("results");
  const certCheckerSection = document.getElementById("certChecker");
  const certForm = document.getElementById("certForm");
  const certInput = document.getElementById("certInput");
  const certFile = document.getElementById("certFile");
  const includeRoot = document.getElementById("includeRoot");
  const certFeedback = document.getElementById("certFeedback");
  const certResults = document.getElementById("certResults");

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

  const hostParam = getQueryParam("hostname");

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

  // ---------- Mode tabs (by domain / by certificate) ----------
  // The domain results panel keeps whatever visibility checkCertificate() last gave it —
  // we only ever forcibly hide it while the certificate tab is active.
  function setMode(mode) {
    const isCert = mode === "cert";
    tabDomain.classList.toggle("active", !isCert);
    tabCert.classList.toggle("active", isCert);
    tabDomain.setAttribute("aria-selected", String(!isCert));
    tabCert.setAttribute("aria-selected", String(isCert));
    checkerSection.classList.toggle("hidden", isCert);
    certCheckerSection.classList.toggle("hidden", !isCert);
    if (isCert) resultsSection.classList.add("hidden");
    else if (certDetails.innerHTML) resultsSection.classList.remove("hidden");
  }

  tabDomain.addEventListener("click", () => setMode("domain"));
  tabCert.addEventListener("click", () => setMode("cert"));

  // ---------- By certificate: file upload ----------
  if (certFile) {
    certFile.addEventListener("change", function () {
      const file = certFile.files && certFile.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = function () {
        certInput.value = String(reader.result || "").trim();
      };

      reader.onerror = function () {
        flashInlineFeedback(certForm, "Couldn't read that file — paste the certificate instead.");
      };

      reader.readAsText(file);
    });
  }

  // ---------- By certificate: generate chain ----------
  if (certForm) {
    certForm.addEventListener("submit", function (e) {
      e.preventDefault();
      generateChainFromCert(certInput.value.trim(), !!(includeRoot && includeRoot.checked));
    });
  }

  async function generateChainFromCert(certPem, wantRoot) {

    if (!certPem) return;

    certFeedback.textContent = "Generating chain...";
    certFeedback.classList.remove("hidden");
    certResults.classList.add("hidden");
    certResults.innerHTML = "";

    try {

      const body = new URLSearchParams({
        include_leaf: "1",
        cert_pem: certPem,
        submit_btn: "Generate Chain"
      });

      if (wantRoot) body.set("include_root", "1");

      const res = await fetch("https://web.api.sslmate.com/whatsmychaincert/generate", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text.trim() || `HTTP ${res.status}`);
      }

      certResults.innerHTML = `
        <h3>Generated Certificate Chain</h3>
        <textarea readonly aria-label="Generated certificate chain (PEM)">${escapeHtml(text)}</textarea>
        <div class="btn-row">
          <button class="copy-btn" id="copyCertChainBtn" type="button">Copy Full Chain</button>
          <button class="copy-btn" id="downloadCertChainBtn" type="button">Download Full Chain (.pem)</button>
        </div>
      `;

      certResults.classList.remove("hidden");

      const copyBtn = document.getElementById("copyCertChainBtn");

      if (copyBtn) {
        copyBtn.addEventListener("click", async function () {
          const textarea = certResults.querySelector("textarea");
          try {
            await navigator.clipboard.writeText(textarea.value);
            flashInlineFeedback(certResults, "Full certificate chain copied!");
          } catch (e) {
            textarea.select();
            flashInlineFeedback(certResults, "Couldn't copy automatically — text is selected, press Ctrl/Cmd+C.");
          }
        });
      }

      const downloadBtn = document.getElementById("downloadCertChainBtn");

      if (downloadBtn) {
        downloadBtn.addEventListener("click", function () {
          const chainText = certResults.querySelector("textarea").value;
          const blob = new Blob([chainText], { type: "application/x-pem-file" });
          const url = URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.href = url;
          a.download = "full-chain.pem";
          document.body.appendChild(a);
          a.click();
          a.remove();

          URL.revokeObjectURL(url);

          flashInlineFeedback(certResults, "Downloaded as full-chain.pem");
        });
      }

    } catch (err) {

      certResults.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
      certResults.classList.remove("hidden");

    } finally {

      certFeedback.classList.add("hidden");

    }

  }

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
            "?hostname=" +
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
          <textarea readonly aria-label="Recommended certificate chain (PEM)">${escapeHtml(result.better_chain || "")}</textarea>
          <div class="btn-row">
            <button class="copy-btn" id="copyChainBtn" type="button">Copy Full Chain</button>
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
              flashInlineFeedback(chainRecommendation, "Full certificate chain copied!");
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

      certDetails.innerHTML = `<p class="error-text">Error: ${escapeHtml(err.message)}</p>`;

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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
