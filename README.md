# md2red · Markdown → 小红书图文生成器

把 Markdown 一键排版成**杂志 / 画廊艺术风**的小红书竖版图片。纯 `HTML + CSS + JS`，零框架、零构建，直接开 GitHub Pages 即可在线使用。

## ✨ 功能

- **Markdown → 图片**：左侧写 Markdown，右侧实时预览成图文卡片。
- **自动分页**：用单独一行的 `---` 把内容切成多页（小红书最多 18 图）。
- **四种风格**：画廊艺术 / 极简黑白 / 暖纸杂志 / 暗夜。
- **三种比例**：3:4 竖版、1:1 方图、9:16 长图。
- **栏目 + 品牌**：可自定义页眉栏目（eyebrow）与页脚品牌署名，自动页码。
- **高清导出**：基于 `html2canvas`，2× 分辨率导出 PNG（单页或全部）。

## 🧱 支持的 Markdown

`# / ## / ### / ####` 标题、`**加粗**`、`*斜体*`、`` `代码` ``、`==高亮==`、`> 引用`、`-` 无序列表、`1.` 有序列表、`![alt](url)` 图片、`[文字](url)` 链接、`---` 分页。

## 🚀 本地使用

直接双击 `index.html` 即可（导出依赖 CDN 上的 html2canvas，需联网）。

## 🌐 GitHub Pages

仓库 **Settings → Pages → Build and deployment**，Source 选 `Deploy from a branch`，分支选 `main` / `(root)`，保存后访问：

```
https://thisisjinyu.github.io/md2red/
```

## 📁 结构

```
index.html              # 界面与工具栏
assets/css/style.css    # 设计令牌 + 卡片排版 + 主题
assets/js/markdown.js   # 轻量 Markdown 解析器（零依赖）
assets/js/app.js        # 分页 / 预览 / 导出逻辑
```

## 🛠 技术说明

- 卡片真实尺寸为 1080×（1080/1440/1920），预览时按舞台大小等比缩放，导出时还原为原始尺寸再 2× 截图，保证清晰。
- 导出前等待 `document.fonts.ready`，避免字体未加载导致的错位。
- 远程图片需支持 CORS 才能被正确导出。
