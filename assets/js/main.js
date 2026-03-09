document.addEventListener("DOMContentLoaded", function() {
  const checkForm = document.getElementById('checkForm');
  const feedback = document.getElementById('feedback');
  const results = document.getElementById('results');
  const certDetails = document.getElementById('certDetails');
  const chainRecommendation = document.getElementById('chainRecommendation');

  checkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hostname = document.getElementById('hostname').value.trim();
    if (!hostname) return;

    feedback.textContent = `Checking certificate chain for ${hostname}...`;
    feedback.classList.remove('hidden');
    results.classList.add('hidden');
    chainRecommendation.classList.add('hidden');

    try {
      const sessionId = 'c6c9c1e73ec58a50f92394e888d4d332';
      const res = await fetch(
        `https://web.api.sslmate.com/whatsmychaincert/evaluate?host=${hostname}&session_id=${sessionId}`
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const result = data.results[0];

      // Certificate status with modern badge
      certDetails.innerHTML = `
        <h3>${hostname}</h3>
        <p>Status: 
          <span class="badge ${result.trusted && !result.leaf_expired ? 'trusted' : 'untrusted'}">
            ${result.trusted && !result.leaf_expired ? 'Trusted' : 'Untrusted'}
          </span>
        </p>
        ${result.leaf_expired ? '<p class="badge untrusted">Expired</p>' : ''}
      `;

      // Recommended chain only if needed
      if (!result.trusted || result.leaf_expired) {
        chainRecommendation.innerHTML = `
          <h3>Recommended Certificate Chain</h3>
          <textarea readonly>${result.better_chain}</textarea>
          <button class="copy-btn">Copy Chain</button>
        `;
        chainRecommendation.classList.remove('hidden');

        const copyBtn = chainRecommendation.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
          const textarea = chainRecommendation.querySelector('textarea');
          textarea.select();
          document.execCommand('copy');
          alert('Certificate chain copied!');
        });
      } else {
        chainRecommendation.classList.add('hidden');
        chainRecommendation.innerHTML = '';
      }

      results.classList.remove('hidden');
    } catch (err) {
      results.classList.remove('hidden');
      certDetails.innerHTML = '';
      chainRecommendation.innerHTML = '';
      results.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    } finally {
      feedback.classList.add('hidden');
    }
  });
});