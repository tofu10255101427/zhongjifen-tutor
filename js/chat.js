/**
 * chat.js — AI 对话逻辑
 */
const PROFILE_KEY = 'jft_profile';

function getApiKey() {
    return localStorage.getItem('jft_api_key') || '';
}

function buildSystemPrompt() {
    const mastery = loadMastery();
    const weakTopics = ALL_KNOWLEDGE_FLAT
        .filter(n => (mastery[n.id] || 0.3) < 0.5)
        .sort((a, b) => (mastery[a.id] || 0.3) - (mastery[b.id] || 0.3))
        .slice(0, 8);

    const weakStr = weakTopics.length > 0
        ? `该用户目前薄弱的知识点（掌握度<50%）：\n${weakTopics.map(t => `- ${t.title}：${t.desc}`).join('\n')}`
        : '该用户暂无明显的薄弱点记录。';

    const profile = loadProfile();

    return `你是"积分向导"——一个高等数学积分学AI导师。你的任务是帮助用户学习二重积分、三重积分、曲线积分和曲面积分。

## 核心原则
1. 不要直接给答案——要通过提问引导用户思考
2. 识别用户的错误类型（积分限搞反、坐标系选错、公式记错、方向判断错等）
3. 根据用户的回答动态调整讲解深度

## 用户画像
${JSON.stringify(profile, null, 2)}

## 薄弱点分析
${weakStr}

## 规定
- 如果用户问非数学问题，礼貌地引导回积分学
- 用LaTeX格式展示数学公式（如 \\(\\int_0^1 x dx\\)）
- 适当鼓励，不要打击用户信心
- 每次回答后，用 ---ANALYSIS--- 分隔符附加一行JSON分析，格式如下（不可省略）：
---ANALYSIS---
{"weaknesses":["double-rect-iter","err-limits"],"profile_update":{"学习风格":"偏好具体例子","常见错误":"积分限搞反"},"confidence_delta":-0.1}
---END---
其中weaknesses是涉及的知识点ID列表（来自用户给出的知识图谱），confidence_delta是用户信心变化（-1到1，负值表示受挫需要鼓励，正值表示掌握得好）。`;
}

function loadProfile() {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
    return {
        "学习风格": "未知（尚未分析）",
        "薄弱点": [],
        "常见错误": [],
        "偏好的讲解方式": "未知",
        "信心指数": 0.5,
        "学习进度": "刚开始"
    };
}

function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

let chatHistory = [];

function addMessage(role, content) {
    chatHistory.push({ role, content });
    if (chatHistory.length > 20) chatHistory.splice(0, chatHistory.length - 20);
}

function renderMessage(role, content) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = content.replace(/\n/g, '<br>');
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'message ai';
    div.id = 'typingIndicator';
    div.textContent = '🤔 思考中...';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}

function parseAnalysis(text) {
    const match = text.match(/---ANALYSIS---\n([\s\S]*?)\n---END---/);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
}

function cleanResponse(text) {
    return text.replace(/---ANALYSIS---[\s\S]*?---END---/, '').trim();
}

function renderProfile() {
    const profile = loadProfile();
    const container = document.getElementById('profileContent');
    
    let html = '';
    for (const [key, val] of Object.entries(profile)) {
        if (key === '薄弱点' && Array.isArray(val) && val.length > 0) {
            html += `<div class="profile-section">
                <h4>${key}</h4>
                ${val.map(v => `<span class="weakness-tag">${v}</span>`).join('')}
            </div>`;
        } else if (key === '常见错误' && Array.isArray(val) && val.length > 0) {
            html += `<div class="profile-section">
                <h4>${key}</h4>
                ${val.map(v => `<span class="weakness-tag">${v}</span>`).join('')}
            </div>`;
        } else if (typeof val === 'number' && key === '信心指数') {
            const pct = Math.round(val * 100);
            const color = val < 0.35 ? '#dc2626' : val < 0.6 ? '#f59e0b' : '#16a34a';
            html += `<div class="profile-section">
                <h4>${key}</h4>
                <div style="font-size:0.9rem;font-weight:600;color:${color}">${pct}%</div>
            </div>`;
        } else if (typeof val === 'string') {
            html += `<div class="profile-item">${key}：${val}</div>`;
        }
    }
    
    if (!html) {
        html = '<p style="color:var(--text-secondary);font-size:0.85rem;">开始学习后，AI会在这里记录你的学习画像。</p>';
    }
    
    container.innerHTML = html;
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        document.getElementById('chatSettingsModal').classList.remove('hidden');
        return;
    }

    renderMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    addMessage('user', text);
    showTyping();

    try {
        const response = await callDeepSeek(apiKey, text);
        removeTyping();
        const analysis = parseAnalysis(response);
        const clean = cleanResponse(response);
        renderMessage('ai', clean);
        addMessage('assistant', clean);
        if (analysis) processAnalysis(analysis);
    } catch (err) {
        removeTyping();
        renderMessage('ai', '😅 抱歉，调用出错了：' + err.message + '\n\n请检查 API Key 是否正确，或者稍后再试。');
        console.error(err);
    }
}

async function callDeepSeek(apiKey, userMessage) {
    const systemPrompt = buildSystemPrompt();
    const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-10)
    ];

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048,
            stream: false
        })
    });

    if (!resp.ok) {
        let errBody;
        try { errBody = await resp.text(); } catch(e) { errBody = '未知错误'; }
        throw new Error(`API错误 ${resp.status}: ${errBody}`);
    }

    const data = await resp.json();
    return data.choices[0].message.content;
}

function processAnalysis(analysis) {
    const profile = loadProfile();
    const mastery = loadMastery();

    if (analysis.weaknesses && Array.isArray(analysis.weaknesses)) {
        analysis.weaknesses.forEach(w => {
            if (mastery[w] !== undefined) {
                mastery[w] = Math.max(0, mastery[w] - 0.05);
            }
        });
        profile.薄弱点 = analysis.weaknesses
            .map(id => { const n = findNode(id); return n ? n.title : id; })
            .filter((v, i, a) => a.indexOf(v) === i);
    }

    if (analysis.profile_update) {
        for (const [key, val] of Object.entries(analysis.profile_update)) {
            if (key === '常见错误') {
                if (!profile.常见错误.includes(val)) profile.常见错误.push(val);
            } else {
                profile[key] = val;
            }
        }
    }

    if (analysis.confidence_delta !== undefined) {
        profile.信心指数 = Math.max(0, Math.min(1, (profile.信心指数 || 0.5) + analysis.confidence_delta));
    }

    saveMastery(mastery);
    saveProfile(profile);
    renderProfile();
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    renderProfile();
});
