# Learning Machine · Exam Question Recognition

A teacher-focused tool that turns exam photos into editable text, with manual source-image crops, math preview, geometry drawing, and print/export helpers. OCR output should always be checked against the original image.

## Features

- Upload JPG/PNG/WEBP images, rotate, crop a question region, and zoom for careful selection.
- Edit OCR output and review flagged uncertain text.
- Render math with KaTeX and preserve original diagram crops alongside editable text.
- Draw points, lines, triangles, rectangles, circles, and labels on a geometry board; zoom, pan, undo/redo, export SVG and editable project JSON.
- Responsive tablet workspace and three UI themes.
- The interface currently sends recognition requests to a fixed, server-side provider route. Do not put provider selection or credentials in browser code.
- Optional whitelist authentication for production. There is no public self-registration.

## Run locally

Requirements: Node.js 18+ and pnpm.

```sh
pnpm install
pnpm start
```

Open <http://127.0.0.1:8765/>. Keep credentials in the ignored local `qwen.local.json` or server-side environment variables. Start from `qwen.local.example.json` and never commit secrets.

Supported server-side settings include:

- `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`
- `DEEPSEEK_API_KEY`
- `QWEN_PAID_API_KEY`

The production Qwen-compatible endpoint and model route are fixed in the server implementation. Never put provider credentials in frontend code, test fixtures, or GitHub.

## Tests

```sh
pnpm test
```

The tests use mocked upstreams or temporary authentication data; they do not need production credentials.

## Production security

Set `NODE_ENV=production`, `AUTH_DATA_FILE`, `AUTH_SECURE=true`, and `PUBLIC_ORIGIN` behind a trusted TLS reverse proxy. Production startup fails if whitelist authentication is not configured. Keep the account database outside the web root and protect provider credentials with restrictive file permissions. Configure an administrator through the server-side bootstrap process; do not publish initial credentials.

## Important limitations

- Vision models can misread text, numbers, formulas, choices, and diagrams. Verify every result against the source.
- Images selected for recognition are sent from the browser through this service to the configured model provider. Confirm that this data transfer is permitted for your images.
- Pricing, retention, availability, and rate limits are controlled by each model provider.
- This repository intentionally excludes sample exam images, OCR results, production deployment files, user databases, and secrets.
