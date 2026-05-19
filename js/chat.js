/**
 * chat.js — AI 对话逻辑
 * 
 * 核心设计：
 *   1. 系统提示词：告诉DeepSeek他是积分学导师，要识别用户薄弱点
 *   2. 每次对话后分析用户暴露的薄弱点，更新 knowledge-map 掌握度
 *   3. 侧边栏展示学习档案
 */

const PROFILE_KEY = 'jft_profile';

// 默认系统提示词
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

// 对话历史（保留最近的20条）
let chatHistory = [];

function addMessage(role, content) {
    chatHistory.push({ role, content });
    if (chatHistory.length > 20) chatHistory.splice(0, chatHistory.length - 20);
}

// 渲染消息
function renderMessage(role, content) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    
    // 将 \\(...\\) 和 \\[...\\] 转为HTML友好的显示
    // 简单处理——不做完整LaTeX渲染，保留标记让用户看到
    div.innerHTML = content.replace(/\n/g, '<br>');
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// 显示"正在输入..."
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

// 解析AI返回中的分析JSON
function parseAnalysis(text) {
    const match = text.match(/---ANALYSIS---\n([\s\S]*?)\n---END---/);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
}

// 清理掉ANALYSIS部分，只保留显示内容
function cleanResponse(text) {
    return text.replace(/---ANALYSIS---[\s\S]*?---END---/, '').trim();
}

// 更新侧边栏画像
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

// 发送消息
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        document.getElementById('chatSettingsModal').classList.remove('hidden');
        return;
    }

    // 显示用户消息
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

        // 处理分析结果
        if (analysis) {
            processAnalysis(analysis);
        }
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
        ...chatHistory.slice(-10) // 只发最近的10条控制token
    ];

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
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
        const errBody = await resp.text();
        throw new Error(`API错误 ${resp.status}: ${errBody}`);
    }

    const data = await resp.json();
    return data.choices[0].message.content;
}

// 处理AI分析结果
function processAnalysis(analysis) {
    const profile = loadProfile();
    const mastery = loadMastery();

    // 1. 更新薄弱点掌握度
    if (analysis.weaknesses && Array.isArray(analysis.weaknesses)) {
        analysis.weaknesses.forEach(w => {
            if (mastery[w] !== undefined) {
                // 每次提及薄弱点，掌握度降低（暴露问题）
                mastery[w] = Math.max(0, mastery[w] - 0.05);
            }
        });
        
        // 同步更新薄弱点列表
        profile.薄弱点 = analysis.weaknesses
            .map(id => {
                const node = findNode(id);
                return node ? node.title : id;
            })
            .filter((v, i, a) => a.indexOf(v) === i); // 去重
    }

    // 2. 更新画像
    if (analysis.profile_update) {
        for (const [key, val] of Object.entries(analysis.profile_update)) {
            if (key === '常见错误') {
                if (!profile.常见错误.includes(val)) {
                    profile.常见错误.push(val);
                }
            } else if (key === '薄弱点') {
                // 已在上面的weaknesses处理了
            } else {
                profile[key] = val;
            }
        }
    }

    // 3. 更新信心指数
    if (analysis.confidence_delta !== undefined) {
        profile.信心指数 = Math.max(0, Math.min(1, 
            (profile.信心指数 || 0.5) + analysis.confidence_delta
        ));
    }

    saveMastery(mastery);
    saveProfile(profile);
    renderProfile();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const settingsBtn = document.getElementById('settingsBtn2');
    const modal = document.getElementById('chatSettingsModal');
    const keyInput = document.getElementById('chatApiKeyInput');
    const saveKeyBtn = document.getElementById('chatSaveKey');
    const keyStatus = document.getElementById('chatApiKeyStatus');
    const closeBtns = document.querySelectorAll('#chatSettingsModal .modal-close');

    // 回填已有Key
    const savedKey = localStorage.getItem('jft_api_key');
    if (savedKey) keyInput.value = savedKey;

    // 发送
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 自动调整输入框高度
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // 设置
    settingsBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    saveKeyBtn.addEventListener('click', () => {
        const key = keyInput.value.trim();
        if (key) {
            localStorage.setItem('jft_api_key', key);
            keyStatus.textContent = '✅ 已保存';
            keyStatus.style.color = '#16a34a';
            setTimeout(() => {
                keyStatus.textContent = '';
                modal.classList.add('hidden');
            }, 1000);
        }
    });

    // 渲染学习档案
    renderProfile();
});
