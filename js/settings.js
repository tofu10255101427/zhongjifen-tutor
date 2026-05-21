/**
 * settings.js — API Key 管理（仅存浏览器 localStorage）
 */
(function() {
    const STORAGE_KEY = 'jft_api_key';
    const modal = document.getElementById('settingsModal');
    const input = document.getElementById('apiKeyInput');
    const saveBtn = document.getElementById('saveApiKey');
    const status = document.getElementById('apiKeyStatus');
    const openBtn = document.getElementById('settingsBtn');
    const closeBtns = document.querySelectorAll('.modal-close');

    // 初始化
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) input.value = saved;

    function getApiKey() {
        return localStorage.getItem(STORAGE_KEY) || '';
    }

    function saveApiKey() {
        const key = input.value.trim();
        if (key) {
            localStorage.setItem(STORAGE_KEY, key);
            status.textContent = '✅ 已保存';
            status.style.color = '#16a34a';
        } else {
            localStorage.removeItem(STORAGE_KEY);
            status.textContent = '已清除';
            status.style.color = '#64748b';
        }
        setTimeout(() => { status.textContent = ''; }, 2000);
    }

    saveBtn.addEventListener('click', saveApiKey);
    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

    window.getApiKey = getApiKey;
})();
