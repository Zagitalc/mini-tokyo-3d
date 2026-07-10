import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {gzipJSON} from '../src/helpers/deterministic-gzip.mjs';
import {runLondonLiveTrainReplay} from '../src/helpers/london-live-train-replay.mjs';

const fixtureNames = [
    'normal-travel',
    'repeated-dwell',
    'branch-switch',
    'missing-id',
    'identity-ambiguity',
    'eta-correction',
    'multi-section-jump',
    'failed-poll',
    'partial-line-failure',
    'stale-recovery',
    'stale-expiry'
];

async function loadFixture(name) {
    const url = new URL(`fixtures/london-live-trains/${name}.json`, import.meta.url);

    return JSON.parse(await fs.readFile(url, 'utf8'));
}

test('live-train replay fixtures use timestamped per-line polls', async () => {
    for (const name of fixtureNames) {
        const fixture = await loadFixture(name);

        assert.ok(Array.isArray(fixture.polls), name);
        assert.ok(fixture.polls.length > 0, name);
        for (const poll of fixture.polls) {
            assert.ok(Number.isFinite(poll.timestamp), name);
            assert.ok(Array.isArray(poll.linePolls), name);
            for (const linePoll of poll.linePolls) {
                assert.equal(typeof linePoll.lineId, 'string', name);
                assert.equal(typeof linePoll.success, 'boolean', name);
            }
        }
    }
});

test('replay harness preserves state and captures commands in timestamp order', () => {
    const fixture = {
        polls: [
            {timestamp: 1000, linePolls: []},
            {timestamp: 2500, linePolls: []}
        ]
    };
    const replay = runLondonLiveTrainReplay({
        fixture,
        processPoll: ({previousStates, timestamp}) => {
            const states = new Map(previousStates);

            states.set('clock', timestamp);
            return {states, commands: [{type: 'none', timestamp}]};
        }
    });

    assert.deepEqual(replay.frames.map(frame => frame.timestamp), [1000, 2500]);
    assert.equal(replay.states.get('clock'), 2500);
    assert.deepEqual(replay.frames[1].commands, [{type: 'none', timestamp: 2500}]);
});

test('gzip JSON output is deterministic and has a zero modification time', async () => {
    const payload = {city: 'london', routes: ['central', 'victoria']};
    const first = await gzipJSON(payload);
    await new Promise(resolve => setTimeout(resolve, 1100));
    const second = await gzipJSON(payload);

    assert.deepEqual(first, second);
    assert.deepEqual([...first.subarray(4, 8)], [0, 0, 0, 0]);
});
