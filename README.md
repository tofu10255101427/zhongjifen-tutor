# 📐 积分向导 — AI数学学习助手

> 人工智能的数学思维 课程实验作业  
> 一个基于 DeepSeek API 的积分学智能学习平台

## 🚀 功能

| 模块 | 说明 |
|------|------|
| 💬 **AI交流区** | 与AI导师对话学习，AI自动分析薄弱点并更新学习画像 |
| 🧠 **思维导图** | 积分学知识图谱，薄弱知识点自动放大标红 |
| 📝 **练习生成** | 根据薄弱点自动出题，支持手动选择标签定制练习 |

## 📚 覆盖内容

- ✅ 二重积分（直角坐标 / 极坐标 / 交换次序 / 求面积）
- ✅ 三重积分（直角 / 柱面 / 球面坐标）
- ✅ 曲线积分（第一类 / 第二类 / 格林公式）
- ✅ 曲面积分（第一类 / 第二类 / 高斯公式 / 斯托克斯公式）

## 🛠️ 使用

1. 双击 `index.html` 在浏览器打开
2. 点击 ⚙️ 设置 → 填入你的 DeepSeek API Key
3. 开始学习！

## 📁 项目结构

```
zhongjifen-tutor/
├── index.html          # 首页
├── chat.html           # AI交流区
├── mindmap.html        # 思维导图区
├── practice.html       # 练习生成区
├── css/
│   └── style.css       # 样式
└── js/
    ├── settings.js      # API Key 管理
    ├── knowledge-map.js # 知识图谱数据 + 掌握度模型
    ├── chat.js          # AI对话 + 学习画像 + 掌握度更新
    └── practice.js      # 练习生成逻辑
```

## 🔑 需要

- DeepSeek API Key（[platform.deepseek.com](https://platform.deepseek.com) 获取）
- 现代浏览器（Chrome / Edge / Firefox）
