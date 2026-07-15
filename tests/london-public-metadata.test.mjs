import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const indexHtml = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('London public metadata identifies the London application', () => {
    assert.match(indexHtml, /<title>Mini London 3D<\/title>/);
    assert.match(indexHtml, /property="og:title" content="Mini London 3D"/);
    assert.match(indexHtml, /property="og:site_name" content="Mini London 3D"/);
    assert.match(indexHtml, /property="og:locale" content="en_GB"/);
    assert.match(indexHtml, /London's public transport system/);
});

test('London public metadata omits inherited ownership and analytics', () => {
    for (const inheritedValue of [
        'minitokyo3d.com',
        '@nagix',
        'googletagmanager.com',
        'G-7NP0LHFG11',
        'rel="canonical"',
        'property="og:url"',
        'property="og:image"',
        'name="twitter:'
    ]) {
        assert.equal(indexHtml.includes(inheritedValue), false, inheritedValue);
    }
});
