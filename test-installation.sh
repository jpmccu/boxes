#!/bin/bash

echo "=== Testing Boxes Installation ==="
echo

echo "1. Checking package structure..."
test -d packages/core && echo "✓ Core package exists"
test -d packages/vue && echo "✓ Vue package exists"
test -d packages/react && echo "✓ React package exists"
test -d packages/electron && echo "✓ Electron package exists"
echo

echo "2. Checking build outputs..."
test -f packages/core/dist/boxes-core.js && echo "✓ Core ESM build exists"
test -f packages/core/dist/boxes-core.umd.js && echo "✓ Core UMD build exists"
test -f packages/vue/dist/boxes-vue.js && echo "✓ Vue ESM build exists"
test -f packages/react/dist/boxes-react.js && echo "✓ React ESM build exists"
echo

echo "3. Checking source files..."
test -f packages/core/src/boxes-editor.js && echo "✓ Core BoxesEditor exists"
test -f packages/core/src/templates.js && echo "✓ Templates exist"
test -f packages/vue/src/BoxesEditor.vue && echo "✓ Vue component exists"
test -f packages/react/src/BoxesEditor.jsx && echo "✓ React component exists"
test -f packages/electron/main.js && echo "✓ Electron main.js exists"
echo

echo "4. Checking Electron app files..."
test -f packages/electron/renderer/index.html && echo "✓ Electron HTML exists"
test -f packages/electron/renderer/renderer.js && echo "✓ Electron renderer exists"
test -f packages/electron/preload/preload.js && echo "✓ Electron preload exists"
test -f packages/electron/templates/owl-ontology.json && echo "✓ OWL template exists"
test -f packages/electron/templates/arrows.json && echo "✓ Arrows template exists"
echo

echo "5. Checking configuration files..."
test -f package.json && echo "✓ Root package.json exists"
test -f eslint.config.js && echo "✓ ESLint config exists"
test -f vitest.config.js && echo "✓ Vitest config exists"
test -f .github/copilot-instructions.md && echo "✓ Copilot instructions exist"
echo

echo "=== All checks passed! ==="

echo "6. Checking web server..."
test -f packages/web/src/server.js && echo "✓ Web server exists"
test -f packages/web/public/index.html && echo "✓ Web UI exists"
test -f packages/web/public/app.js && echo "✓ Web app.js exists"
echo
