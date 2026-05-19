/**
 * practice.js — 练习生成逻辑
 * 
 * 设计：
 *   1. 标签选择 → AI生成题目
 *   2. 智能推荐 → 根据薄弱点自动选题
 *   3. 显示答案可折叠
 */

let selectedTags = new Set();

// 标签点击切换
document.addEventListener('DOMContentLoaded', () => {
    // 标签交互
    document.querySelectorAll('.tag-option').forEach(el => {
        el.addEventListener('click', () => {
            const tag = el.dataset.tag;
            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
                el.classList.remove('selected');
            } else {
                selectedTags.add(tag);
                el.classList.add('selected');
            }
        });
    });

    document.getElementById('clearTagsBtn').addEventListener('click', () => {
        selectedTags.clear();
        document.querySelectorAll('.tag-option').forEach(el => el.classList.remove('selected'));
    });

    document.getElementById('generateBtn').addEventListener('click', generatePractice);
    document.getElementById('smartGenBtn').addEventListener('click', smartGenerate);

    // Settings
    const settingsBtn = document.getElementById('settingsBtn3');
    const modal = document.getElementById('practiceSettingsModal');
    const keyInput = document.getElementById('practiceApiKeyInput');
    const saveBtn = document.getElementById('practiceSaveKey');
    const keyStatus = document.getElementById('practiceApiKeyStatus');
    const closeBtns = document.querySelectorAll('#practiceSettingsModal .modal-close');

    const savedKey = localStorage.getItem('jft_api_key');
    if (savedKey) keyInput.value = savedKey;

    settingsBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    saveBtn.addEventListener('click', () => {
        const key = keyInput.value.trim();
        if (key) {
            localStorage.setItem('jft_api_key', key);
            keyStatus.textContent = '✅ 已保存';
            keyStatus.style.color = '#16a34a';
            setTimeout(() => { keyStatus.textContent = ''; modal.classList.add('hidden'); }, 1000);
        }
    });
});

function updateGenerateStatus(msg) {
    document.getElementById('generateStatus').textContent = msg;
}

// 标签 → 中文名映射
const TAG_LABELS = {
    'double-rect': '二重积分直角坐标',
    'double-polar': '二重积分极坐标',
    'double-iter-swap': '积分次序交换',
    'double-area': '二重积分求面积',
    'triple-rect': '三重积分直角坐标',
    'triple-cyl': '三重积分柱面坐标',
    'triple-sph': '三重积分球面坐标',
    'curve-first': '第一类曲线积分',
    'curve-second': '第二类曲线积分',
    'green': '格林公式',
    'surface-first': '第一类曲面积分',
    'surface-second': '第二类曲面积分',
    'gauss': '高斯公式',
    'stokes': '斯托克斯公式',
    'diff-easy': '基础难度',
    'diff-mid': '中等难度',
    'diff-hard': '困难难度',
};

async function generatePractice() {
    const apiKey = getApiKey();
    if (!apiKey) {
        document.getElementById('practiceSettingsModal').classList.remove('hidden');
        return;
    }

    const tags = Array.from(selectedTags);
    if (tags.length === 0) {
        updateGenerateStatus('⚠️ 请至少选择一个标签');
        return;
    }

    updateGenerateStatus('🤖 AI正在出题...');
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('questionsContainer').innerHTML = '';

    try {
        const content = await callDeepSeekForQuestions(apiKey, tags);
        renderQuestions(content, tags);
        updateGenerateStatus(`✅ 已生成（标签：${tags.map(t => TAG_LABELS[t] || t).join('、')}）`);
    } catch (err) {
        updateGenerateStatus('❌ 生成失败：' + err.message);
        document.getElementById('emptyState').style.display = 'block';
    }
}

async function smartGenerate() {
    // 从掌握度数据中找出最薄弱的几个知识点
    const mastery = loadMastery();
    const weakTopics = ALL_KNOWLEDGE_FLAT
        .filter(n => n.id !== 'root' && (mastery[n.id] || 0.3) < 0.5)
        .sort((a, b) => (mastery[a.id] || 0.3) - (mastery[b.id] || 0.3))
        .slice(0, 3);

    // 从知识图谱中找对应标签
    const autoTags = [];
    weakTopics.forEach(t => {
        const tag = t.id;
        if (TAG_LABELS[tag]) autoTags.push(tag);
    });

    if (autoTags.length === 0) {
        // 没有明确的薄弱标签，新增一些默认
        autoTags.push('double-rect', 'double-iter-swap', 'green');
    }

    // 选中这些标签
    selectedTags.clear();
    document.querySelectorAll('.tag-option').forEach(el => el.classList.remove('selected'));
    autoTags.forEach(tag => {
        selectedTags.add(tag);
        document.querySelector(`.tag-option[data-tag="${tag}"]`)?.classList.add('selected');
    });

    updateGenerateStatus(`🎯 根据薄弱点自动选题：${autoTags.map(t => TAG_LABELS[t] || t).join('、')}`);
    
    await generatePractice();
}

async function callDeepSeekForQuestions(apiKey, tags) {
    const difficulty = tags.find(t => t.startsWith('diff-')) || 'diff-mid';
    const topicTags = tags.filter(t => !t.startsWith('diff-'));
    const diffLabel = { 'diff-easy': '基础', 'diff-mid': '中等', 'diff-hard': '困难' }[difficulty] || '中等';

    // 获取用户薄弱信息
    const profile = loadProfile();
    const mastery = loadMastery();
    const weakStr = topicTags
        .map(t => {
            const m = mastery[t] || 0.3;
            return `${TAG_LABELS[t] || t}（掌握度：${Math.round(m * 100)}%）`;
        })
        .join('、');

    const systemPrompt = `你是高等数学积分学习题的出题老师。根据以下要求生成练习题。

要求：
1. 题目范围：${topicTags.map(t => TAG_LABELS[t] || t).join('、')}
2. 难度：${diffLabel}
3. 题量：4道（包含不同类型的题目）
4. 用户薄弱情况：${weakStr}

输出格式要求——请严格按以下JSON格式输出，不要输出其他内容：
{
  "questions": [
    {
      "id": 1,
      "title": "题目1的简短标题",
      "content": "题目完整内容（用LaTeX格式，如 \\\\(\\\\int_0^1 x dx\\\\) ）",
      "tags": ["double-rect"],
      "difficulty": "基础",
      "answer": "详细解答过程"
    }
  ]
}`;

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `请为以下主题生成练习题：${topicTags.map(t => TAG_LABELS[t] || t).join('、')}，难度：${diffLabel}` }
            ],
            temperature: 0.8,
            max_tokens: 4096,
            response_format: { type: 'json_object' }
        })
    });

    if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`API错误 ${resp.status}: ${errBody}`);
    }

    const data = await resp.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.questions || [];
}

function renderQuestions(questions, tags) {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';

    if (!questions || questions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="emoji">😅</div><p>AI暂时没法生成题目，请调整标签再试</p></div>';
        return;
    }

    questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.id = `q-${idx}`;

        const tagHtml = (q.tags || tags.filter(t => !t.startsWith('diff-')))
            .map(t => `<span>${TAG_LABELS[t] || t}</span>`)
            .join('');

        card.innerHTML = `
            <div class="q-title">${idx + 1}. ${q.title}</div>
            <div class="q-tags">${tagHtml} <span style="background:#f3f4f6;color:#6b7280;">${q.difficulty || ''}</span></div>
            <div class="q-content">${q.content}</div>
            <button class="btn-secondary show-answer-btn" data-qid="${idx}">👁️ 查看答案</button>
            <div class="answer-content" id="answer-${idx}">${q.answer}</div>
        `;

        container.appendChild(card);
    });

    // 绑定查看答案按钮
    document.querySelectorAll('.show-answer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const qid = btn.dataset.qid;
            const answerEl = document.getElementById(`answer-${qid}`);
            if (answerEl.classList.contains('show')) {
                answerEl.classList.remove('show');
                btn.textContent = '👁️ 查看答案';
            } else {
                answerEl.classList.add('show');
                btn.textContent = '🙈 隐藏答案';
            }
        });
    });
}
