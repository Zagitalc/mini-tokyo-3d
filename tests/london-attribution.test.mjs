import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import configs from '../src/configs.js';
import {normalizeCustomAttributions} from '../src/helpers/attributions.mjs';

const UPSTREAM_ATTRIBUTION = '<a href="https://github.com/nagix/mini-tokyo-3d">© Akihiko Kusanagi</a>';
const mapSource = await readFile(new URL('../src/map.js', import.meta.url), 'utf8');

test('custom attribution normalization removes absent and blank entries', () => {
    assert.deepEqual(normalizeCustomAttributions(undefined, undefined), []);
    assert.deepEqual(normalizeCustomAttributions(null, '', '   ', [], [null, ['\t']]), []);
});

test('custom attribution normalization preserves nested valid strings in order', () => {
    const caller = '<a href="https://example.com/project">Project source</a>';
    const provider = '<a href="https://example.com/provider">Data provider</a>';

    assert.deepEqual(
        normalizeCustomAttributions([caller, [[provider]]], configs.customAttribution),
        [caller, provider, UPSTREAM_ATTRIBUTION]
    );
});

test('custom attribution normalization rejects unsupported values and duplicates', () => {
    const unsupported = {toString: () => '[object Object]'};

    assert.deepEqual(
        normalizeCustomAttributions(unsupported, 0, false, configs.customAttribution, [configs.customAttribution]),
        [UPSTREAM_ATTRIBUTION]
    );
});

test('London restores the historical upstream attribution exactly once', () => {
    assert.equal(configs.customAttribution, UPSTREAM_ATTRIBUTION);
    assert.equal(normalizeCustomAttributions(configs.customAttribution, configs.customAttribution).length, 1);
});

test('custom attribution normalization remains limited to maps without ConfigControl', () => {
    assert.match(
        mapSource,
        /if \(!options\.configControl\) \{\s*options\.customAttribution = normalizeCustomAttributions\(/
    );
});
