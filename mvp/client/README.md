# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## 指标字典增强

- 左侧新增分类树，可按“业务域 → 模块 → 场景”逐级筛选指标，便于管理多套 TOB 指标体系。
- 指标表单支持录入业务域、场景、适用说明、客群 Segment、别名等扩展字段，帮助沉淀元数据。
- 提供“成本效率 / 资源效率 / 风险监控”三类模板，创建或发布新版本时可一键带出常用字段。
- 指标详情页展示分类、适用说明、别名与数据 Owner，方便跨团队协同。
