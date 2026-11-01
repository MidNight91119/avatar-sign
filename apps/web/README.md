# @signstream/web

Owner: **Hasan** (`/watch`, `/signs`, shared layout) · **Ayush** (`/`, `/extension`, `/discover`) · Spec: [specs/hasan.md](../../specs/hasan.md)

The signside website. Pages, design tokens and UI rules are documented in the
[UI and frontend guide](../../packages/ui/README.md).

```bash
pnpm --filter @signstream/web dev     # http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8787 pnpm --filter @signstream/web dev   # against a local API
```

Without `NEXT_PUBLIC_API_URL` the site uses the shared mock track and sign list, and says so on screen.
