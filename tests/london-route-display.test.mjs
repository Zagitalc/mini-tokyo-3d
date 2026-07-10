import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildTangentClampedFallback,
    collectOsmRelationCandidates,
    extractLondonRelationCorridors,
    matchOsmRelationCandidate,
    projectStationsMonotonically,
    validateLondonCorridorGeometry
} from '../src/helpers/london-route-display.mjs';

test('collectOsmRelationCandidates preserves relation identity', () => {
    const candidates = collectOsmRelationCandidates({
        features: [{
            type: 'Feature',
            properties: { '@id': 'relation/12345', route: 'subway' },
            geometry: {
                type: 'MultiLineString',
                coordinates: [
                    [[-0.12, 51.5], [-0.11, 51.5]],
                    [[-0.11, 51.5], [-0.10, 51.5]]
                ]
            }
        }]
    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].relationId, 'osm-relation-12345');
    assert.equal(candidates[0].alignmentId, 'osm-relation-12345:path-1');
    assert.deepEqual(candidates[0].coordinates[0], [-0.12, 51.5]);
    assert.deepEqual(candidates[0].coordinates.at(-1), [-0.10, 51.5]);
});

test('projectStationsMonotonically reverses an opposing relation path', () => {
    const projection = projectStationsMonotonically(
        [[-0.10, 51.5], [-0.11, 51.5], [-0.12, 51.5]],
        [[-0.12, 51.5], [-0.11, 51.5], [-0.10, 51.5]]
    );

    assert.equal(projection.valid, true);
    assert.equal(projection.reversed, true);
    assert.ok(projection.stationOffsets[2] > projection.stationOffsets[1]);
});

test('matchOsmRelationCandidate rejects non-monotonic candidates', () => {
    const stations = [[-0.12, 51.5], [-0.11, 51.5], [-0.10, 51.5]];
    const match = matchOsmRelationCandidate([
        {
            relationId: 'bad',
            alignmentId: 'bad:path-1',
            coordinates: [[-0.12, 51.5], [-0.10, 51.5], [-0.11, 51.5]]
        },
        {
            relationId: 'good',
            alignmentId: 'good:path-1',
            coordinates: stations
        }
    ], stations);

    assert.equal(match.candidate.relationId, 'good');
});

test('validateLondonCorridorGeometry rejects excessive detours', () => {
    const validation = validateLondonCorridorGeometry(
        [[-0.12, 51.5], [-0.5, 52], [-0.10, 51.5]],
        [-0.12, 51.5],
        [-0.10, 51.5]
    );

    assert.equal(validation.valid, false);
    assert.equal(validation.reason, 'excessive-detour');
});

test('extractLondonRelationCorridors falls back only for the invalid corridor', () => {
    const stationCoords = [
        [-0.12, 51.5],
        [-0.11, 51.5],
        [-0.10, 51.5]
    ];
    const match = {
        candidate: {
            alignmentId: 'osm-relation-1:path-1'
        },
        projection: {
            coordinates: [
                [-0.12, 51.5],
                [-0.11, 51.5],
                [-0.5, 52],
                [-0.10, 51.5]
            ],
            stationOffsets: [0, 0.69, 66]
        }
    };
    const corridors = extractLondonRelationCorridors(match, stationCoords);

    assert.equal(corridors.length, 2);
    assert.equal(corridors[0].geometrySource, 'osm');
    assert.equal(corridors[1].geometrySource, 'fallback');
    assert.equal(corridors[0].alignmentId, corridors[1].alignmentId);
});

test('buildTangentClampedFallback keeps exact endpoints and finite coordinates', () => {
    const fallback = buildTangentClampedFallback(
        [-0.13, 51.49],
        [-0.12, 51.5],
        [-0.10, 51.5],
        [-0.09, 51.6]
    );

    assert.deepEqual(fallback[0], [-0.12, 51.5]);
    assert.deepEqual(fallback.at(-1), [-0.10, 51.5]);
    assert.ok(fallback.length >= 5);
    assert.equal(fallback.every(coord => coord.every(Number.isFinite)), true);
});
