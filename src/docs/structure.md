# 项目结构

当前项目沿用了 Vite + Vue 3 的标准结构，并结合 InspiraUI 的资源组织方式。

## 核心目录

- `src/components/ui`：动效与视觉组件，包含 `BlackHoleBackground`。
- `src/docs`：文档内容与侧栏配置，支持多级导航。
- `src/App.vue`：主页布局与文档阅读器，实现黑洞背景与文档展示的一体化页面。

## 配置文件

- `src/docs/config.json`：用于声明侧栏分组与子文章顺序，类似 VitePress 的导航结构。
- `tsconfig.app.json`：开启严格类型检查，并允许从 JSON 中导入配置。

只要在 `src/docs` 中新增 Markdown 文件，并在 `config.json` 中配置，即可立即出现在界面中。
