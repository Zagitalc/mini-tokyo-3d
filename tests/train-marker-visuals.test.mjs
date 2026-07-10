import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_CAR_DIMENSIONS,
    getCarGeometryArguments,
    getLondonTrainScaleFactor,
    LONDON_TRAIN_DIMENSIONS,
    LONDON_TRAIN_SCALE_PROFILE,
    resolveCarDimensions,
    TRAIN_MARKER_AXES
} from '../src/helpers/train-marker-visuals.mjs';

test('train marker axes document lateral, longitudinal, and vertical dimensions', () => {
    assert.deepEqual(TRAIN_MARKER_AXES, {
        width: 'x-lateral',
        height: 'y-longitudinal',
        depth: 'z-vertical'
    });
});

test('car marker defaults preserve the existing Tokyo dimensions', () => {
    assert.deepEqual(resolveCarDimensions(), {
        width: 0.88,
        height: 1.76,
        depth: 0.88
    });
    assert.deepEqual(DEFAULT_CAR_DIMENSIONS, resolveCarDimensions({}));
});

test('London marker dimensions have a four-to-one longitudinal aspect ratio', () => {
    assert.equal(LONDON_TRAIN_DIMENSIONS.height / LONDON_TRAIN_DIMENSIONS.width, 4);
    assert.deepEqual(getCarGeometryArguments(LONDON_TRAIN_DIMENSIONS), [0.32, 1.28, 0.28]);
});

test('invalid dimension overrides fall back per axis without changing valid axes', () => {
    assert.deepEqual(resolveCarDimensions({width: 0.4, height: 0, depth: NaN}), {
        width: 0.4,
        height: 1.76,
        depth: 0.88
    });
});

test('London train zoom profile peaks at 14 and decreases monotonically afterward', () => {
    assert.equal(getLondonTrainScaleFactor(9), 0.20);
    assert.equal(getLondonTrainScaleFactor(14), 0.80);
    assert.equal(getLondonTrainScaleFactor(15.5), 0.69);
    assert.equal(getLondonTrainScaleFactor(20), 0.46);

    const afterPeak = LONDON_TRAIN_SCALE_PROFILE.filter(([zoom]) => zoom >= 14);

    for (let i = 1; i < afterPeak.length; i++) {
        assert.ok(afterPeak[i][1] <= afterPeak[i - 1][1]);
    }
});
