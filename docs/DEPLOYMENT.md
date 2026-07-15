# Mini London 3D deployment

This document prepares a future static deployment. It does not create or alter a provider project, account, credential, DNS record, Worker, Pages Function, workflow, redirect, deployment hook, attribution label, or provider credit. Following this guide's repository checks does not push or deploy the application.

## Recommended host: Cloudflare Pages

Use the following Pages project settings:

- Production branch: `master`
- Preview deployments: non-production branches
- Build output directory: `build`
- Environment variable: `NODE_VERSION=24.18.0`
- Environment variable: `MAPBOX_ACCESS_TOKEN=<URL-restricted public token>`

Cloudflare installs project dependencies before invoking the build command. Use this build command in the Pages dashboard:

```bash
npm run build:london && node -e "const fs=require('node:fs'); const token=process.env.MAPBOX_ACCESS_TOKEN; if (!token) throw new Error('Missing MAPBOX_ACCESS_TOKEN'); fs.writeFileSync('build/config.local.js', 'window.MT3D_CONFIG = ' + JSON.stringify({accessToken: token, city: 'london'}) + ';\n');"
```

Do not add `npm ci` to that command unless automatic dependency installation is deliberately disabled with `SKIP_DEPENDENCY_INSTALL=1`.

The generated `config.local.js` is necessary because `index.html` loads it unconditionally, while `public/config.local.js` is intentionally excluded from Git. The generated file contains only browser-public configuration and must never contain a TfL credential.

### Credentials and first-deployment behavior

The Mapbox access token is expected to reach the browser. Restrict it to the assigned production and preview origins in Mapbox before promoting the site.

Cloudflare build environment variables are not automatically private from browser code. Any value written into a static asset becomes public. Never embed a TfL app key in the bundle, `config.local.js`, a committed configuration file, or a frontend build variable.

### TfL credential revocation and repository scanning

The TfL credential previously found in ignored local runtime configuration must be treated as compromised. The user must revoke it through an authorised TfL account before any public preview and must never reuse it. Repository work cannot prove revocation: record it as an external deployment prerequisite unless its status is verified through the authorised account interface.

Before preview deployment, scan the current tracked tree and reachable Git history using the known TfL configuration-key patterns, the known credential format without printing its value, and recognised secret scanners where available. Record scanner names and scopes, but report only affected file paths, commit identifiers and remediation status. A `git grep` result alone cannot establish that no historical credential ever existed.

Use one of these sanitised conclusions:

```text
No tracked or historical TfL credential was detected by the documented checks.
```

```text
Potential historical exposure was detected; affected commits and remediation steps are reported without exposing the credential.
```

A public preview may use the application's unauthenticated direct TfL requests only after external credential revocation. Live trains and service data remain best-effort: rejected, rate-limited, blocked and unavailable responses must retain visible graceful states. Do not describe this mode as reliable production live data.

Before treating live data as production-reliable, add a same-origin Pages Function or Worker proxy. Store the rotated TfL credential as a server-side Cloudflare secret, allowlist the exact required TfL paths and HTTP methods, inject the credential server-side, and reject arbitrary upstream URLs so the endpoint cannot become an open proxy. Expose only the proxy base URL through the existing `tflProxyBase` option.

### Build acceptance

Run the normal build locally, then generate a placeholder runtime config without using a real token:

```bash
npm run build:london
MAPBOX_ACCESS_TOKEN=pk.validation-placeholder node -e "const fs=require('node:fs'); const token=process.env.MAPBOX_ACCESS_TOKEN; if (!token) throw new Error('Missing MAPBOX_ACCESS_TOKEN'); fs.writeFileSync('build/config.local.js', 'window.MT3D_CONFIG = ' + JSON.stringify({accessToken: token, city: 'london'}) + ';\n');"
```

Validate the output without printing the token:

```bash
test -f build/index.html
test -f build/config.local.js
grep -q "MT3D_CONFIG" build/config.local.js
git ls-files --error-unmatch public/config.local.js && exit 1 || true

find build -type f | wc -l
find build -type f -exec stat -f "%z %N" {} \; | sort -nr | head -20
```

On Linux, list the largest assets with:

```bash
find build -type f -printf '%s %p\n' | sort -nr | head -20
```

Before deployment, confirm:

- `build/index.html` and `build/config.local.js` exist;
- `public/config.local.js` remains absent from Git;
- the build contains fewer than 20,000 files;
- no individual asset exceeds 25 MiB;
- direct navigation and static asset loading succeed;
- browser-facing output contains no TfL credential;
- `index.html` and `config.local.js` use revalidation or no-cache behavior and never immutable caching;
- immutable caching is used only for genuinely content-addressed assets;
- the generated HTML contains no inherited Mini Tokyo domain, analytics ID, or social ownership metadata.

Cloudflare Pages Free currently permits 500 builds per month, up to 20,000 files per project, and a maximum individual asset size of 25 MiB. Static-asset requests are free and unlimited. Check the current [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [static-asset pricing](https://developers.cloudflare.com/workers/platform/pricing/), and [build image documentation](https://developers.cloudflare.com/pages/configuration/build-image/) before deployment.

## Preview gate

Do not create a public preview until all of the following are true:

- the compromised TfL credential has been revoked through the authorised account interface, or preview remains blocked;
- the exact Pages preview origin is included in the public Mapbox token's URL restrictions;
- the generated runtime configuration contains only the restricted Mapbox token and `city: "london"`, plus an approved `tflProxyBase` only when a proxy exists;
- direct navigation, static assets and graceful TfL unavailable states have been tested;
- browser-facing output contains no credential or local runtime configuration;
- the preview is labelled best-effort and is not presented as production-reliable live service.

## Production gate

Do not promote a preview to production until all of the following are true:

- reviewed work has been merged into `master`;
- the restricted same-origin TfL proxy is complete and uses a rotated server-side credential;
- the final domain has been assigned before canonical, Open Graph URL and social-image metadata are added;
- [the Mini London 3D source repository](https://github.com/Zagitalc/mini-london-3d) is publicly accessible;
- analytics and social-account metadata remain absent unless project-owned values and consent requirements are confirmed;
- preview network traffic has been observed before enforcing CSP or other security headers, so Mapbox workers, WebGL resources and approved TfL traffic remain functional.

## Public metadata required before production

Do not promote a Pages preview to production until `public/index.html` and the generated `build/index.html` have been reviewed.

- Use the final Mini London 3D domain for the canonical URL and `og:url` after that domain is assigned.
- Provide a Mini London 3D `og:image` hosted on the final origin.
- Add Twitter account metadata only if a project-owned account is confirmed.
- Add analytics only after a project-owned measurement ID and consent requirements are confirmed.
- Verify the Mini London 3D title, description, locale, site name, and social preview.

Until those values are confirmed, omit the inherited Mini Tokyo URLs, image, Twitter account, and Google Analytics measurement ID instead of inventing replacements.

Project source: [Zagitalc/mini-london-3d](https://github.com/Zagitalc/mini-london-3d). Upstream software attribution and licence notices remain separate and must be preserved.

## Free-host alternatives

### Render Static Site

Use `npm run build:london` with publish directory `build`. Render Hobby currently includes 5 GB of monthly bandwidth and 500 build minutes. See [Render pricing](https://render.com/pricing).

### GitHub Pages

GitHub Pages can publish `build` through an Actions workflow, but this repository intentionally does not add that workflow yet. Current guidance includes a 1 GB published-site limit, a 100 GB monthly soft bandwidth limit, and a soft limit of ten builds per hour. See [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

### Netlify Free

Netlify can use the same build command and output directory. Its current Free plan uses a shared allowance of 300 monthly credits and pauses projects when the allowance is exhausted. See [Netlify pricing](https://www.netlify.com/pricing/).

### Vercel Hobby

Vercel can host the static output, but Hobby is restricted to personal, non-commercial use. See [Vercel pricing](https://vercel.com/pricing).
