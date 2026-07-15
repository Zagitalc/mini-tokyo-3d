import assert from 'node:assert/strict';
import test from 'node:test';
import {
    composeLondonTrainOpacity,
    getLondonTrainOpacityTargets,
    LONDON_TRAIN_OPACITY
} from '../src/helpers/london-train-opacity.mjs';

const closeTo = (actual, expected) => {
    assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
};

test('London train opacity constants preserve focused and secondary hierarchy', () => {
    assert.deepEqual(LONDON_TRAIN_OPACITY, {
        focused: 0.96,
        secondary: 0.82,
        searchDimmed: 0.10
    });
    assert.equal(Object.isFrozen(LONDON_TRAIN_OPACITY), true);
});

test('London train view opacity composes with search dimming', () => {
    assert.deepEqual(getLondonTrainOpacityTargets('ground', 'none'), {
        ground: 0.96,
        underground: 0.82
    });
    assert.deepEqual(getLondonTrainOpacityTargets('underground', 'none'), {
        ground: 0.82,
        underground: 0.96
    });

    const groundSearch = getLondonTrainOpacityTargets('ground', 'search');
    const undergroundSearch = getLondonTrainOpacityTargets('underground', 'search');

    closeTo(groundSearch.ground, 0.096);
    closeTo(groundSearch.underground, 0.082);
    closeTo(undergroundSearch.ground, 0.082);
    closeTo(undergroundSearch.underground, 0.096);
});

test('London train lifecycle opacity remains an independent multiplier', () => {
    closeTo(composeLondonTrainOpacity({
        lifecycleOpacity: 0.5,
        viewModeOpacity: LONDON_TRAIN_OPACITY.focused,
        searchModeOpacity: LONDON_TRAIN_OPACITY.searchDimmed
    }), 0.048);
    closeTo(composeLondonTrainOpacity({
        lifecycleOpacity: 0,
        viewModeOpacity: LONDON_TRAIN_OPACITY.focused,
        searchModeOpacity: LONDON_TRAIN_OPACITY.searchDimmed
    }), 0);
    closeTo(composeLondonTrainOpacity({
        lifecycleOpacity: 0,
        viewModeOpacity: LONDON_TRAIN_OPACITY.secondary,
        searchModeOpacity: 1
    }), 0);
});
