import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {runLondonLiveTrainReplay} from '../src/helpers/london-live-train-replay.mjs';
import {
    deriveRendererCommand,
    processLiveTrainPoll,
    transitionTrainState
} from '../src/helpers/london-live-train-state.mjs';

async function replay(name) {
    const url = new URL(`fixtures/london-live-trains/${name}.json`, import.meta.url);
    const fixture = JSON.parse(await fs.readFile(url, 'utf8'));

    return runLondonLiveTrainReplay({fixture, processPoll: processLiveTrainPoll});
}

test('same-section corrections use normalized progress clamps', () => {
    const previous = {
        trainKey: 't', lineId: 'circle', direction: 'clockwise', routeId: 'main', state: 'moving',
        sectionIndex: 3, sectionProgress: 0.5, lastValidSectionIndex: 3, lastValidProgress: 0.5,
        lastObservationAt: 0, lastFreshEvidenceAt: 0, lastProgressEvidenceAt: 0,
        missingSince: null, missingAgeMs: 0, lastCoveragePollAt: 0, coverageWasComplete: true,
        pendingRouteId: null, pendingRouteLeadCount: 0, stalePhase: 'none'
    };
    const backward = transitionTrainState(previous, {
        lineId: 'circle', routeId: 'main', sectionIndex: 3, sectionProgress: 0.1
    }, [], {timestamp: 10000, identityConfidence: 1});
    const forward = transitionTrainState(previous, {
        lineId: 'circle', routeId: 'main', sectionIndex: 3, sectionProgress: 0.9
    }, [], {timestamp: 10000, identityConfidence: 1});

    assert.equal(backward.state.sectionProgress, 0.48);
    assert.ok(backward.diagnostics.includes('backward-correction-clamped'));
    assert.equal(forward.state.sectionProgress, 0.65);
    assert.ok(forward.diagnostics.includes('forward-correction-clamped'));
});

test('unexplained multi-section jumps retain the last valid position', async () => {
    const result = await replay('multi-section-jump');
    const state = result.states.get('piccadilly|P1');

    assert.equal(state.sectionIndex, 2);
    assert.ok(result.frames[1].diagnostics.some(value => value.code === 'jump-multiple-sections'));
});

test('dwell is edge-triggered and has exact 10s and 45s boundaries', async () => {
    const result = await replay('repeated-dwell');
    const [first, second, third] = result.frames.map(frame => frame.states.get('metropolitan|M1'));

    assert.equal(first.enteredStationAt, 0);
    assert.equal(second.enteredStationAt, 0);
    assert.equal(second.state, 'dwelling');
    assert.equal(third.state, 'stale');
    assert.equal(third.stalePhase, 'freeze');
});

test('route switching requires score margin, confirmation, and a boundary', async () => {
    const result = await replay('branch-switch');
    const states = result.frames.map(frame => frame.states.get('northern|N1'));

    assert.equal(states[0].routeId, 'northern-bank');
    assert.equal(states[1].routeId, 'northern-bank');
    assert.equal(states[1].pendingRouteLeadCount, 1);
    assert.equal(states[2].routeId, 'northern-charing-cross');
    assert.equal(result.frames[2].commands[0].type, 'rebind');
});

test('stale boundaries are inclusive at 30s and 90s', () => {
    const initial = {
        trainKey: 't', lineId: 'district', state: 'moving', routeId: 'main', sectionIndex: 1,
        sectionProgress: 0.4, lastValidSectionIndex: 1, lastValidProgress: 0.4,
        missingSince: 0, missingAgeMs: 0, lastCoveragePollAt: 0, coverageWasComplete: true,
        stalePhase: 'none'
    };
    const at30 = transitionTrainState(initial, null, [], {
        timestamp: 30000, success: true, observationsComplete: true
    }).state;
    const at90 = transitionTrainState({...at30, lastCoveragePollAt: 30000}, null, [], {
        timestamp: 90000, success: true, observationsComplete: true
    }).state;

    assert.equal(at30.missingAgeMs, 30000);
    assert.equal(at30.stalePhase, 'freeze');
    assert.equal(at90.missingAgeMs, 90000);
    assert.equal(at90.state, 'expired');
});

test('failed line polls do not age missing trains', async () => {
    const result = await replay('partial-line-failure');
    const central = result.states.get('central|C1');
    const victoria = result.states.get('victoria|V1');

    assert.equal(central.state, 'stale');
    assert.equal(victoria.state, 'moving');
    assert.equal(victoria.missingAgeMs, 0);
    assert.ok(result.frames[1].diagnostics.some(value =>
        value.trainKey === 'victoria|V1' && value.code === 'poll-failed-no-aging'
    ));
});

test('renderer commands distinguish recovery before and after expiry', () => {
    const moving = {state: 'moving', routeId: 'main'};
    const stale = {state: 'stale', routeId: 'main', stalePhase: 'freeze'};
    const expired = {state: 'expired', routeId: 'main'};

    assert.deepEqual(deriveRendererCommand(moving, stale), {type: 'hold', phase: 'freeze'});
    assert.deepEqual(deriveRendererCommand(stale, moving), {type: 'update'});
    assert.deepEqual(deriveRendererCommand(expired, moving), {type: 'create'});
});
