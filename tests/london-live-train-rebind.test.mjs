import test from 'node:test';
import assert from 'node:assert/strict';

import {transactionalRebindLondonTrain} from '../src/helpers/london-live-train-rebind.mjs';

test('transactional route rebind preserves renderer identity and unrelated object state', () => {
    const oldRailway = {id: 'northern-bank'};
    const nextRailway = {id: 'northern-charing-cross'};
    const train = {
        instanceID: 17,
        r: oldRailway,
        sectionIndex: 8,
        sectionLength: 1,
        selected: true,
        tracked: true
    };
    let applied;

    transactionalRebindLondonTrain({
        train,
        routeId: nextRailway.id,
        railway: nextRailway,
        sectionIndex: 9,
        sectionLength: 1,
        progress: 0,
        resolveBinding: () => ({routeIndex: 31, colorIndex: 4}),
        applyBinding: binding => {
            applied = binding;
        }
    });

    assert.equal(train.instanceID, 17);
    assert.equal(train.r, nextRailway);
    assert.equal(train.sectionIndex, 9);
    assert.equal(train.selected, true);
    assert.equal(train.tracked, true);
    assert.deepEqual(applied, {
        instanceID: 17,
        routeIndex: 31,
        colorIndex: 4,
        sectionIndex: 9,
        nextSectionIndex: 10,
        progress: 0
    });
});

test('failed route rebind leaves the train object unchanged', () => {
    const railway = {id: 'northern-bank'};
    const train = {
        instanceID: 17,
        r: railway,
        sectionIndex: 8,
        sectionLength: 1,
        _londonProgress: 0.8
    };
    const snapshot = {...train};

    assert.throws(() => transactionalRebindLondonTrain({
        train,
        routeId: 'northern-charing-cross',
        railway: {id: 'northern-charing-cross'},
        sectionIndex: 9,
        sectionLength: 1,
        progress: 0,
        resolveBinding: () => ({routeIndex: 31, colorIndex: 4}),
        applyBinding: () => {
            throw new Error('GPU write failed');
        }
    }), /GPU write failed/);

    assert.deepEqual(train, snapshot);
});
