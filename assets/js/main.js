document.addEventListener("DOMContentLoaded", function () {

  const checkForm = document.getElementById("checkForm");
  const feedback = document.getElementById("feedback");
  const results = document.getElementById("results");
  const certDetails = document.getElementById("certDetails");
  const chainRecommendation = document.getElementById("chainRecommendation");
  const hostnameInput = document.getElementById("hostname");

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

      const result = data.results[0];

      const trusted = result.trusted && !result.leaf_expired;

      certDetails.innerHTML = `
        <h3>${hostname}</h3>
        <p>Status:
          <span class="badge ${trusted ? "trusted" : "untrusted"}">
            ${trusted ? "Trusted" : "Untrusted"}
          </span>
        </p>
        ${result.leaf_expired ? '<p class="badge untrusted">Expired</p>' : ""}
        <button id="shareLinkBtn" class="copy-btn">Share Link</button>
      `;

      const shareBtn = document.getElementById("shareLinkBtn");

      if (shareBtn) {

        shareBtn.addEventListener("click", function () {

          const shareUrl =
            window.location.origin +
            window.location.pathname +
            "?host=" +
            encodeURIComponent(hostname);

          navigator.clipboard.writeText(shareUrl);

          alert("Sharable link copied to clipboard!");

        });

      }

      if (!trusted && chainRecommendation) {

        chainRecommendation.innerHTML = `
          <h3>Recommended Certificate Chain</h3>
          <textarea readonly>${result.better_chain}</textarea>
          <button class="copy-btn" id="copyChainBtn">Copy Chain</button>
        `;

        chainRecommendation.classList.remove("hidden");

        const copyBtn = document.getElementById("copyChainBtn");

        if (copyBtn) {

          copyBtn.addEventListener("click", function () {

            const textarea = chainRecommendation.querySelector("textarea");

            textarea.select();

            document.execCommand("copy");

            alert("Certificate chain copied!");

          });

        }

      }

      results.classList.remove("hidden");

    } catch (err) {

      results.classList.remove("hidden");

      certDetails.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;

      if (chainRecommendation) {
        chainRecommendation.innerHTML = "";
      }

    } finally {

      feedback.classList.add("hidden");

    }

  }

});