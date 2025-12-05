
```
smarted
├─ backend
│  ├─ package-lock.json
│  ├─ package.json
│  └─ src
│     ├─ er-generate.js
│     └─ server.js
├─ frontend
│  ├─ .stryker-tmp
│  │  └─ sandbox-mV3aaU
│  │     ├─ eslint.config.js
│  │     ├─ index.html
│  │     ├─ package-lock.json
│  │     ├─ package.json
│  │     ├─ postcss.config.js
│  │     ├─ public
│  │     │  ├─ loader.gif
│  │     │  └─ vite.svg
│  │     ├─ README.md
│  │     ├─ src
│  │     │  ├─ api
│  │     │  │  └─ ai.ts
│  │     │  ├─ App.css
│  │     │  ├─ App.tsx
│  │     │  ├─ canvas
│  │     │  │  ├─ components
│  │     │  │  │  ├─ AIPanel.tsx
│  │     │  │  │  ├─ CanvasGrid.tsx
│  │     │  │  │  ├─ ConfirmModal.tsx
│  │     │  │  │  ├─ EditorToolbar.tsx
│  │     │  │  │  ├─ EntitiesLayer.tsx
│  │     │  │  │  ├─ LinkHintToast.tsx
│  │     │  │  │  ├─ Minimap.tsx
│  │     │  │  │  ├─ RelationChip.tsx
│  │     │  │  │  ├─ RelationInspector.tsx
│  │     │  │  │  ├─ RelationLabel.tsx
│  │     │  │  │  ├─ RelationsLayer.tsx
│  │     │  │  │  ├─ RelationsSvg.tsx
│  │     │  │  │  ├─ SQLPanel.tsx
│  │     │  │  │  └─ ValidationHints.tsx
│  │     │  │  ├─ geom
│  │     │  │  │  └─ index.ts
│  │     │  │  ├─ hooks
│  │     │  │  │  ├─ index.ts
│  │     │  │  │  ├─ useCamera.ts
│  │     │  │  │  └─ useMeasureCards.ts
│  │     │  │  ├─ types
│  │     │  │  │  └─ index.ts
│  │     │  │  └─ utils
│  │     │  │     └─ index.ts
│  │     │  ├─ components
│  │     │  │  └─ EditorCanvas.tsx
│  │     │  ├─ i18n
│  │     │  │  └─ index.ts
│  │     │  ├─ index.css
│  │     │  ├─ main.tsx
│  │     │  ├─ pages
│  │     │  │  ├─ AIPage.tsx
│  │     │  │  └─ EditorPage.tsx
│  │     │  ├─ store
│  │     │  │  ├─ useAppStore.ts
│  │     │  │  └─ useERStore.ts
│  │     │  └─ utils
│  │     │     ├─ generateSQL.ts
│  │     │     ├─ sql
│  │     │     │  ├─ common.ts
│  │     │     │  ├─ index.ts
│  │     │     │  ├─ mysql.ts
│  │     │     │  ├─ postgres.ts
│  │     │     │  └─ types.ts
│  │     │     ├─ tests
│  │     │     │  ├─ helpers.ts
│  │     │     │  ├─ validateModel.mockHelpers.test.ts
│  │     │     │  └─ validateModel.test.ts
│  │     │     └─ validateModel.ts
│  │     ├─ stryker.conf.json
│  │     ├─ tailwind.config.js
│  │     ├─ tsconfig.app.json
│  │     ├─ tsconfig.json
│  │     ├─ tsconfig.node.json
│  │     ├─ vite.config.ts
│  │     └─ vitest.config.ts
│  ├─ cucumber.mjs
│  ├─ eslint.config.js
│  ├─ features
│  │  ├─ fk_types.feature
│  │  ├─ relations.feature
│  │  ├─ step_definitions
│  │  │  └─ common.steps.ts
│  │  ├─ support
│  │  │  ├─ hooks.ts
│  │  │  └─ state.ts
│  │  └─ validation_entities.feature
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ postcss.config.js
│  ├─ public
│  │  ├─ loader.gif
│  │  └─ vite.svg
│  ├─ README.md
│  ├─ reports
│  │  └─ mutation
│  │     └─ mutation.html
│  ├─ src
│  │  ├─ api
│  │  │  └─ ai.ts
│  │  ├─ App.css
│  │  ├─ App.tsx
│  │  ├─ canvas
│  │  │  ├─ components
│  │  │  │  ├─ AIPanel.tsx
│  │  │  │  ├─ CanvasGrid.tsx
│  │  │  │  ├─ ConfirmModal.tsx
│  │  │  │  ├─ EditorToolbar.tsx
│  │  │  │  ├─ EntitiesLayer.tsx
│  │  │  │  ├─ LinkHintToast.tsx
│  │  │  │  ├─ Minimap.tsx
│  │  │  │  ├─ RelationChip.tsx
│  │  │  │  ├─ RelationInspector.tsx
│  │  │  │  ├─ RelationLabel.tsx
│  │  │  │  ├─ RelationsLayer.tsx
│  │  │  │  ├─ RelationsSvg.tsx
│  │  │  │  ├─ SQLPanel.tsx
│  │  │  │  └─ ValidationHints.tsx
│  │  │  ├─ geom
│  │  │  │  └─ index.ts
│  │  │  ├─ hooks
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ useCamera.ts
│  │  │  │  └─ useMeasureCards.ts
│  │  │  ├─ types
│  │  │  │  └─ index.ts
│  │  │  └─ utils
│  │  │     └─ index.ts
│  │  ├─ components
│  │  │  └─ EditorCanvas.tsx
│  │  ├─ i18n
│  │  │  └─ index.ts
│  │  ├─ index.css
│  │  ├─ main.tsx
│  │  ├─ pages
│  │  │  ├─ AIPage.tsx
│  │  │  └─ EditorPage.tsx
│  │  ├─ store
│  │  │  ├─ useAppStore.ts
│  │  │  └─ useERStore.ts
│  │  └─ utils
│  │     ├─ generateSQL.ts
│  │     ├─ sql
│  │     │  ├─ common.ts
│  │     │  ├─ index.ts
│  │     │  ├─ mysql.ts
│  │     │  ├─ postgres.ts
│  │     │  └─ types.ts
│  │     ├─ tests
│  │     │  ├─ helpers.ts
│  │     │  ├─ validateModel.mockHelpers.test.ts
│  │     │  └─ validateModel.test.ts
│  │     └─ validateModel.ts
│  ├─ stryker.conf.json
│  ├─ tailwind.config.js
│  ├─ tools
│  │  └─ plot_perf.mjs
│  ├─ tsconfig.app.json
│  ├─ tsconfig.cucumber.json
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  ├─ vite.config.ts
│  └─ vitest.config.ts
└─ README.md

```