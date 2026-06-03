/**
 * practice.js — 练习生成逻辑
 * 
 * 设计：
 *   1. 标签选择 → AI生成题目
 *   2. 智能推荐 → 根据薄弱点自动选题
 *   3. 显示答案可折叠
 */

// ===== 离散数学标签扁平列表 =====
var ALL_KNOWLEDGE_FLAT = [];
(function() {
    var nodes = [
        { id: 'root', title: '离散数学' },
        { id: 'proposition', title: '命题与联结词' },
        { id: 'truth-table', title: '真值表' },
        { id: 'equivalence', title: '等价演算' },
        { id: 'normal-form', title: '范式' },
        { id: 'inference', title: '推理' },
        { id: 'predicate', title: '谓词与量词' },
        { id: 'prenex', title: '前束范式' },
        { id: 'pred-inference', title: '谓词推理' },
        { id: 'perm-comb', title: '排列组合' },
        { id: 'pigeonhole', title: '鸽巢原理' },
        { id: 'binomial', title: '二项式定理' },
        { id: 'inclusion', title: '容斥原理' },
        { id: 'recurrence', title: '递推关系' },
        { id: 'generating-function', title: '生成函数' },
        { id: 'catalan', title: '卡特兰数' },
        { id: 'rel-matrix', title: '关系矩阵' },
        { id: 'rel-props', title: '关系性质' },
        { id: 'equivalence-rel', title: '等价关系' },
        { id: 'partial-order', title: '偏序关系' },
        { id: 'closure', title: '关系闭包' }
    ];
    ALL_KNOWLEDGE_FLAT = nodes;
})();

// 掌握度存储
function loadMastery() {
    var raw = localStorage.getItem('jft_mastery');
    if (raw) {
        try { return JSON.parse(raw); }
        catch(e) {}
    }
    var m = {};
    for (var i = 0; i < ALL_KNOWLEDGE_FLAT.length; i++) {
        m[ALL_KNOWLEDGE_FLAT[i].id] = 0.3;
    }
    return m;
}

function saveMastery(m) {
    localStorage.setItem('jft_mastery', JSON.stringify(m));
}

// 标签 → 中文名映射
const TAG_LABELS = {
    'proposition': '命题与联结词',
    'truth-table': '真值表',
    'equivalence': '等价演算',
    'normal-form': '范式',
    'inference': '推理',
    'predicate': '谓词与量词',
    'prenex': '前束范式',
    'pred-inference': '谓词推理',
    'perm-comb': '排列组合',
    'pigeonhole': '鸽巢原理',
    'binomial': '二项式定理',
    'inclusion': '容斥原理',
    'recurrence': '递推关系',
    'generating-function': '生成函数',
    'catalan': '卡特兰数',
    'rel-matrix': '关系矩阵',
    'rel-props': '关系性质',
    'equivalence-rel': '等价关系',
    'partial-order': '偏序关系',
    'closure': '关系闭包',
    'diff-easy': '基础难度',
    'diff-mid': '中等难度',
    'diff-hard': '困难难度',
};

// 直接定义 getApiKey，不依赖 settings.js
function getApiKey() {
    return localStorage.getItem('jft_api_key') || '';
}

let selectedTags = new Set();

// 标签点击切换
document.addEventListener('DOMContentLoaded', () => {
    // 标签交互
    document.querySelectorAll('.tag-btn').forEach(el => {
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
        document.querySelectorAll('.tag-btn').forEach(el => el.classList.remove('selected'));
    });

    document.getElementById('generateBtn').addEventListener('click', generatePractice);
    document.getElementById('smartGenBtn').addEventListener('click', smartGenerate);
});

function updateGenerateStatus(msg) {
    document.getElementById('generateStatus').textContent = msg;
}

async function generatePractice() {
    const apiKey = getApiKey();
    if (!apiKey) {
        document.getElementById('settingsModal').classList.remove('hidden');
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
        autoTags.push('proposition', 'inference', 'perm-comb');
    }

    // 选中这些标签
    selectedTags.clear();
    document.querySelectorAll('.tag-btn').forEach(el => el.classList.remove('selected'));
    autoTags.forEach(tag => {
        selectedTags.add(tag);
        document.querySelector(`.tag-btn[data-tag="${tag}"]`)?.classList.add('selected');
    });

    updateGenerateStatus(`🎯 根据薄弱点自动选题：${autoTags.map(t => TAG_LABELS[t] || t).join('、')}`);
    
    await generatePractice();
}

async function callDeepSeekForQuestions(apiKey, tags) {
    const difficulty = tags.find(t => t.startsWith('diff-')) || 'diff-mid';
    const topicTags = tags.filter(t => !t.startsWith('diff-'));
    const diffLabel = { 'diff-easy': '基础', 'diff-mid': '中等', 'diff-hard': '困难' }[difficulty] || '中等';

    // 获取用户薄弱信息
    const mastery = loadMastery();
    const weakStr = topicTags
        .map(t => {
            const m = mastery[t] || 0.3;
            return `${TAG_LABELS[t] || t}（掌握度：${Math.round(m * 100)}%）`;
        })
        .join('、');

    const systemPrompt = `你是离散数学学习题的出题老师。根据以下要求生成练习题。

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
      "content": "题目完整内容（用LaTeX格式，如 \\\\(\\P \\land Q \\rightarrow R\\\\) ）",
      "tags": ["proposition"],
      "difficulty": "基础",
      "answer": "详细解答过程"
    }
  ]
}`;

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        mode: 'cors',
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
        container.innerHTML = '<div class="practice-empty"><div class="icon">😅</div><h3>暂无题目</h3><p>AI暂时没法生成题目，请调整标签再试</p></div>';
        return;
    }

    questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'q-card';

        const tagHtml = (q.tags || tags.filter(t => !t.startsWith('diff-')))
            .map(t => `<span>${TAG_LABELS[t] || t}</span>`)
            .join('');

        card.innerHTML = `
            <div class="q-header">
                <div class="q-number">${idx + 1}</div>
                <div class="q-title-text">${q.title}</div>
            </div>
            <div class="q-tags">${tagHtml} ${q.difficulty ? '<span class="diff-tag">' + q.difficulty + '</span>' : ''}</div>
            <div class="q-body">${q.content}</div>
            <div class="q-footer">
                <button class="show-answer-btn" data-qid="${idx}">👁️ 查看答案</button>
            </div>
            <div class="q-answer" id="answer-${idx}">${q.answer}</div>
        `;

        container.appendChild(card);
    });

    // 渲染KaTeX公式
    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(container, { delimiters: [{left: '\\(', right: '\\)', display: false},{left: '\\[', right: '\\]', display: true}] });
    }

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
