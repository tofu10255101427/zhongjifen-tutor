/**
 * knowledge-map.js
 * 积分知识图谱数据 + 掌握度模型
 * 
 * 结构：
 *   每个知识点有 id, title, desc, parent, children, difficulty
 *   mastery（掌握度）通过 AI 对话分析动态更新
 */

const KNOWLEDGE_MAP = {
    id: 'root',
    title: '积分学',
    desc: '高等数学积分部分的完整知识体系',
    children: [
        {
            id: 'double',
            title: '二重积分',
            desc: '在平面区域上的积分',
            children: [
                {
                    id: 'double-rect',
                    title: '直角坐标系',
                    desc: '将区域投影到坐标轴确定积分限',
                    children: [
                        { id: 'double-rect-desc', title: '区域描述与积分限', desc: 'X型/Y型区域的划分与积分限确定' },
                        { id: 'double-rect-iter', title: '累次积分与交换次序', desc: '先积x还是先积y？次序交换时上下限变换规则' },
                    ]
                },
                {
                    id: 'double-polar',
                    title: '极坐标系',
                    desc: '圆/扇形区域适合转为极坐标',
                    children: [
                        { id: 'double-polar-convert', title: '直角→极坐标转换', desc: 'x=rcosθ, y=rsinθ, dxdy=rdrdθ' },
                        { id: 'double-polar-limits', title: '极坐标下积分限', desc: 'r和θ的范围确定——射线穿入穿出法' },
                    ]
                },
                {
                    id: 'double-apply',
                    title: '应用',
                    desc: '二重积分在几何与物理中的应用',
                    children: [
                        { id: 'double-area', title: '平面区域面积', desc: 'A = ∬_D dσ' },
                        { id: 'double-mass', title: '平面薄片质量/质心', desc: 'M = ∬_D ρ(x,y) dσ' },
                    ]
                }
            ]
        },
        {
            id: 'triple',
            title: '三重积分',
            desc: '在空间区域上的积分',
            children: [
                {
                    id: 'triple-rect',
                    title: '直角坐标系',
                    desc: '投影法与截面法确定积分限',
                    children: [
                        { id: 'triple-rect-proj', title: '投影法（先一后二）', desc: '先对z积分，再对xy区域的二重积分' },
                        { id: 'triple-rect-section', title: '截面法（先二后一）', desc: '先对xy截面做二重积分，再对z积分' },
                    ]
                },
                {
                    id: 'triple-cyl',
                    title: '柱面坐标系',
                    desc: '适合绕z轴旋转对称的区域：x=rcosθ, y=rsinθ, z=z, dv=rdrdθdz',
                },
                {
                    id: 'triple-sph',
                    title: '球面坐标系',
                    desc: '适合球体/锥体区域：x=ρsinφcosθ, y=ρsinφsinθ, z=ρcosφ, dv=ρ²sinφ dρdφdθ',
                }
            ]
        },
        {
            id: 'curve',
            title: '曲线积分',
            desc: '在曲线上对函数或向量场积分',
            children: [
                {
                    id: 'curve-first',
                    title: '第一类曲线积分',
                    desc: '对弧长的曲线积分——与方向无关',
                    children: [
                        { id: 'curve-first-calc', title: '计算方法', desc: '参数化→代入弧微分ds' },
                    ]
                },
                {
                    id: 'curve-second',
                    title: '第二类曲线积分',
                    desc: '对坐标的曲线积分——与方向有关',
                    children: [
                        { id: 'curve-second-calc', title: '计算方法', desc: '参数化→代入dx,dy' },
                        { id: 'green', title: '格林公式', desc: '将封闭曲线积分转化为二重积分 ∮_L Pdx+Qdy = ∬_D (∂Q/∂x - ∂P/∂y) dσ' },
                    ]
                }
            ]
        },
        {
            id: 'surface',
            title: '曲面积分',
            desc: '在曲面上对函数或向量场积分',
            children: [
                {
                    id: 'surface-first',
                    title: '第一类曲面积分',
                    desc: '对面积的曲面积分',
                    children: [
                        { id: 'surface-first-calc', title: '计算方法', desc: '曲面参数化→代入面积微元dS' },
                    ]
                },
                {
                    id: 'surface-second',
                    title: '第二类曲面积分',
                    desc: '对坐标的曲面积分——与侧有关',
                    children: [
                        { id: 'surface-second-calc', title: '计算方法', desc: '投影法计算各分量' },
                        { id: 'gauss', title: '高斯公式', desc: '将封闭曲面积分转化为三重积分 ∯_Σ Pdy∧dz+... = ∭_V (∂P/∂x+∂Q/∂y+∂R/∂z) dv' },
                        { id: 'stokes', title: '斯托克斯公式', desc: '将空间曲线积分转化为曲面积分' },
                    ]
                }
            ]
        },
        {
            id: 'common-errors',
            title: '常见错误',
            desc: '学生最容易出问题的地方',
            children: [
                { id: 'err-limits', title: '积分限搞反', desc: '上下限顺序错误、区域投影错误、次序交换错误' },
                { id: 'err-coord', title: '坐标系选择错误', desc: '该用极坐标却用直角坐标、该用球坐标却用柱坐标' },
                { id: 'err-jacobi', title: '雅可比行列式漏了', desc: '坐标变换时忘记乘以雅可比行列式' },
                { id: 'err-direction', title: '方向/侧搞混', desc: '第二类曲线积分/曲面积分方向判断错误' },
            ]
        }
    ]
};

/**
 * 掌握度存储
 * 格式：{ "double-rect-desc": 0.3, "green": 0.1, ... }
 * 0=完全不会, 1=完全掌握
 */
const MASTERY_KEY = 'jft_mastery';

function loadMastery() {
    const raw = localStorage.getItem(MASTERY_KEY);
    if (raw) return JSON.parse(raw);
    // 初始值——全部 0.3（略懂皮毛）
    const m = {};
    function traverse(node) {
        m[node.id] = 0.3;
        if (node.children) node.children.forEach(traverse);
    }
    traverse(KNOWLEDGE_MAP);
    return m;
}

function saveMastery(mastery) {
    localStorage.setItem(MASTERY_KEY, JSON.stringify(mastery));
}

function updateMastery(knowledgeId, delta) {
    const m = loadMastery();
    if (m[knowledgeId] !== undefined) {
        m[knowledgeId] = Math.max(0, Math.min(1, m[knowledgeId] + delta));
        saveMastery(m);
    }
}

function getMasteryLevel(knowledgeId) {
    const m = loadMastery();
    return m[knowledgeId] || 0.3;
}

function getMasteryColor(val) {
    if (val < 0.35) return '#dc2626';
    if (val < 0.6) return '#f59e0b';
    return '#16a34a';
}

function getMasteryLabel(val) {
    if (val < 0.35) return '待加强';
    if (val < 0.6) return '一般';
    if (val < 0.85) return '良好';
    return '已掌握';
}

// 展平树
function flattenMap(node, list = []) {
    list.push({ id: node.id, title: node.title, desc: node.desc });
    if (node.children) node.children.forEach(c => flattenMap(c, list));
    return list;
}

function findNode(id, node = KNOWLEDGE_MAP) {
    if (node.id === id) return node;
    if (node.children) {
        for (const c of node.children) {
            const found = findNode(id, c);
            if (found) return found;
        }
    }
    return null;
}

const ALL_KNOWLEDGE_FLAT = flattenMap(KNOWLEDGE_MAP);
