import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';

const packageJSON = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../assets/london-build-data/manifest.json', import.meta.url), 'utf8'));

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

test('the hosted London build uses tracked runtime data instead of ignored source data', () => {
    const buildScript = packageJSON.scripts['build-data:london'];
    const sourceScript = packageJSON.scripts['build-data:london:source'];

    assert.match(buildScript, /assets\/london-build-data\/\*\.json\.gz/);
    assert.equal(buildScript.includes('MT3D_DATA_DIR=data-london'), false);
    assert.match(sourceScript, /MT3D_DATA_DIR=data-london/);
});

for (const [file, expected] of Object.entries(manifest.files)) {
    test(`tracked London runtime snapshot verifies ${file}`, async () => {
        const compressed = await readFile(new URL(`../assets/london-build-data/${file}`, import.meta.url));

        assert.equal(sha256(compressed), expected.sha256);
        assert.equal(sha256(gunzipSync(compressed)), expected.payloadSha256);
    });
}
