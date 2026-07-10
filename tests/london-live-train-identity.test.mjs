import test from 'node:test';
import assert from 'node:assert/strict';

import {normalizeTfLObservations} from '../src/helpers/london-live-train-observations.mjs';
import {
    createLondonSyntheticTrainId,
    matchObservationsToTrainStates,
    scoreLondonTrainIdentity
} from '../src/helpers/london-live-train-identity.mjs';

test('normalization groups TfL predictions by authoritative vehicle ID', () => {
    const observations = normalizeTfLObservations([
        {vehicleId: 'V1', lineId: 'victoria', naptanId: 'A', timeToStation: 40},
        {vehicleId: 'V1', lineId: 'victoria', naptanId: 'B', timeToStation: 80}
    ], {timestamp: 1000});

    assert.equal(observations.length, 1);
    assert.equal(observations[0].observationId, 'victoria|V1');
    assert.deepEqual(observations[0].predictions.map(value => value.stationId), ['A', 'B']);
});

test('normalization partitions anonymous predictions when stations contain multiple trains', () => {
    const observations = normalizeTfLObservations([
        {lineId: 'central', direction: 'eastbound', destinationName: 'Epping', naptanId: 'A', timeToStation: 20},
        {lineId: 'central', direction: 'eastbound', destinationName: 'Epping', naptanId: 'A', timeToStation: 80},
        {lineId: 'central', direction: 'eastbound', destinationName: 'Epping', naptanId: 'B', timeToStation: 60},
        {lineId: 'central', direction: 'eastbound', destinationName: 'Epping', naptanId: 'B', timeToStation: 120}
    ], {timestamp: 1000});

    assert.equal(observations.length, 2);
    assert.deepEqual(observations.map(value => value.predictions.map(prediction => prediction.timeToStation)), [
        [20, 60],
        [80, 120]
    ]);
});

test('synthetic IDs are session-local and monotonic', () => {
    assert.equal(createLondonSyntheticTrainId('abc', 7), 'london-synthetic-abc-7');
    assert.equal(createLondonSyntheticTrainId('abc', 8), 'london-synthetic-abc-8');
    assert.equal(createLondonSyntheticTrainId('def', 7), 'london-synthetic-def-7');
});

test('identity scoring rejects incompatible lines, directions, distant sections, and ETAs', () => {
    const state = {
        lineId: 'central',
        direction: 'eastbound',
        routeId: 'central-main',
        sectionIndex: 4,
        lastTimeToStation: 20
    };

    assert.equal(scoreLondonTrainIdentity(state, {...state, lineId: 'victoria'}), null);
    assert.equal(scoreLondonTrainIdentity(state, {...state, direction: 'westbound'}), null);
    assert.equal(scoreLondonTrainIdentity(state, {...state, sectionIndex: 7}), null);
    assert.equal(scoreLondonTrainIdentity(state, {...state, timeToStation: 100}), null);
});

test('missing-ID assignment is one-to-one', () => {
    const previousStates = new Map([
        ['a', {trainKey: 'a', syntheticId: 'a', lineId: 'central', direction: 'eastbound', routeId: 'main', sectionIndex: 4, lastTimeToStation: 20}],
        ['b', {trainKey: 'b', syntheticId: 'b', lineId: 'central', direction: 'eastbound', routeId: 'main', sectionIndex: 5, lastTimeToStation: 50}]
    ]);
    const observations = [
        {observationId: 'o1', lineId: 'central', direction: 'eastbound', routeId: 'main', sectionIndex: 4, timeToStation: 18},
        {observationId: 'o2', lineId: 'central', direction: 'eastbound', routeId: 'main', sectionIndex: 5, timeToStation: 48}
    ];
    const result = matchObservationsToTrainStates(previousStates, observations, {sessionId: 's'});

    assert.deepEqual(result.matches.map(match => match.trainKey).sort(), ['a', 'b']);
});

test('ambiguous identities are not collapsed', () => {
    const previousStates = new Map([
        ['a', {trainKey: 'a', syntheticId: 'a', lineId: 'central', direction: 'eastbound', routeId: 'main', sectionIndex: 4, lastTimeToStation: 20}],
        ['b', {trainKey: 'b', syntheticId: 'b', lineId: 'central', direction: 'eastbound', routeId: 'main', sectionIndex: 4, lastTimeToStation: 22}]
    ]);
    const observations = [
        {observationId: 'o1', lineId: 'central', direction: 'eastbound', routeId: 'main', sectionIndex: 4, timeToStation: 21}
    ];
    const result = matchObservationsToTrainStates(previousStates, observations, {
        sessionId: 'session',
        syntheticCounter: 9
    });

    assert.equal(result.matches[0].trainKey, 'london-synthetic-session-9');
    assert.equal(result.matches[0].diagnosticCode, 'ambiguous-identity');
    assert.equal(result.nextSyntheticCounter, 10);
});
