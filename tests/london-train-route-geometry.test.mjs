import assert from 'node:assert/strict';
import test from 'node:test';
import {buildLondonTrainRouteFeature} from '../src/helpers/london-train-route-geometry.mjs';

const railway = {
    id: 'tfl.test.1',
    stations: [
        {id: 'a', coord: [-0.2, 51.5]},
        {id: 'b', coord: [-0.1, 51.51]},
        {id: 'c', coord: [0, 51.5]}
    ]
};
const baseFeature = {
    type: 'Feature',
    geometry: {type: 'LineString', coordinates: railway.stations.map(station => station.coord)},
    properties: {id: railway.id, type: 0, altitude: 1}
};

test('renderer routes stitch topology-aware display corridors in station order', () => {
    const displayFeatures = [
        {
            type: 'Feature',
            geometry: {type: 'LineString', coordinates: [[-0.1, 51.51], [-0.05, 51.53], [0, 51.5]]},
            properties: {railwayIds: [railway.id], corridorId: 'b-c'}
        },
        {
            type: 'Feature',
            geometry: {type: 'LineString', coordinates: [[-0.1, 51.51], [-0.15, 51.49], [-0.2, 51.5]]},
            properties: {railwayIds: [railway.id], corridorId: 'a-b'}
        }
    ];
    const result = buildLondonTrainRouteFeature({railway, displayFeatures, baseFeature});

    assert.deepEqual(result.feature.geometry.coordinates, [
        [-0.2, 51.5], [-0.15, 51.49], [-0.1, 51.51], [-0.05, 51.53], [0, 51.5]
    ]);
    assert.equal(result.feature.properties['london-display-aligned'], true);
    assert.equal(result.feature.properties['station-offsets'].length, 3);
    assert.ok(result.feature.properties['station-offsets'][2] > result.feature.properties['station-offsets'][1]);
    assert.deepEqual(result.corridorSources.map(item => item.geometrySource), ['display', 'display']);
});
test('renderer route fallback is corridor-local', () => {
    const displayFeatures = [{
        type: 'Feature',
        geometry: {type: 'LineString', coordinates: [[-0.2, 51.5], [-0.15, 51.49], [-0.1, 51.51]]},
        properties: {railwayIds: [railway.id], corridorId: 'a-b'}
    }];
    const result = buildLondonTrainRouteFeature({railway, displayFeatures, baseFeature});

    assert.deepEqual(result.corridorSources.map(item => item.geometrySource), ['display', 'fallback']);
    assert.deepEqual(result.feature.geometry.coordinates.at(-1), [0, 51.5]);
});
