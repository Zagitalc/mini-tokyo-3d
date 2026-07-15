import test from 'node:test';
import assert from 'node:assert/strict';

import {
    areLondonCorridorAlignmentsEquivalent,
    assignLondonAlignmentIds,
    buildTangentClampedFallback,
    buildLondonDisplayFeatureCollection,
    canonicalizeLondonCorridors,
    collectOsmRelationCandidates,
    extractLondonRelationCorridors,
    makeLondonCorridorId,
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

function corridorRecord(overrides = {}) {
    return {
        fromGroup: 'station-a',
        toGroup: 'station-b',
        alignmentId: 'osm-relation-123:path-1',
        lineId: 'circle',
        railwayId: 'tfl.circle.1',
        color: '#FFD300',
        geometrySource: 'osm',
        coordinates: [[-0.12, 51.5], [-0.11, 51.5]],
        ...overrides
    };
}

test('makeLondonCorridorId includes explicit alignment identity', () => {
    assert.equal(
        makeLondonCorridorId('station-b', 'station-a', 'osm-relation-123:path-7'),
        'station-a__station-b__osm-relation-123-path-7'
    );
});

test('canonicalizeLondonCorridors keeps different alignments separate', () => {
    const corridors = canonicalizeLondonCorridors([
        corridorRecord(),
        corridorRecord({ alignmentId: 'osm-relation-999:path-2', lineId: 'metropolitan' })
    ]);

    assert.equal(corridors.length, 2);
    assert.notEqual(corridors[0].corridorId, corridors[1].corridorId);
    assert.equal(corridors.every(corridor => corridor.lines.length === 1), true);
});

test('canonicalizeLondonCorridors normalizes direction and assigns symmetric lanes', () => {
    const corridors = canonicalizeLondonCorridors([
        corridorRecord(),
        corridorRecord({
            fromGroup: 'station-b',
            toGroup: 'station-a',
            lineId: 'metropolitan',
            railwayId: 'tfl.metropolitan.2',
            color: '#9B0056',
            coordinates: [[-0.11, 51.5], [-0.12, 51.5]]
        }),
        corridorRecord({
            lineId: 'hammersmith-city',
            railwayId: 'tfl.hammersmith-city.1',
            color: '#F3A9BB'
        })
    ]);

    assert.equal(corridors.length, 1);
    assert.deepEqual(corridors[0].coordinates, [[-0.12, 51.5], [-0.11, 51.5]]);
    assert.deepEqual(corridors[0].lines.map(line => line.lineId), [
        'circle', 'hammersmith-city', 'metropolitan'
    ]);
    assert.deepEqual(corridors[0].lines.map(line => line.laneOffset), [-1, 0, 1]);
});

test('canonicalizeLondonCorridors prefers OSM geometry over fallback geometry', () => {
    const corridors = canonicalizeLondonCorridors([
        corridorRecord({
            geometrySource: 'fallback',
            coordinates: [[-0.12, 51.5], [-0.115, 51.51], [-0.11, 51.5]]
        }),
        corridorRecord({
            lineId: 'metropolitan',
            railwayId: 'tfl.metropolitan.1'
        })
    ]);

    assert.equal(corridors[0].geometrySource, 'osm');
    assert.deepEqual(corridors[0].coordinates, [[-0.12, 51.5], [-0.11, 51.5]]);
});

test('display filtering does not recalculate build-time lane metadata', () => {
    const featureCollection = buildLondonDisplayFeatureCollection([
        corridorRecord(),
        corridorRecord({ lineId: 'district', railwayId: 'tfl.district.1' }),
        corridorRecord({ lineId: 'metropolitan', railwayId: 'tfl.metropolitan.1' }),
        corridorRecord({ lineId: 'hammersmith-city', railwayId: 'tfl.hammersmith-city.1' })
    ]);
    const before = featureCollection.features.map(feature => ({
        lineId: feature.properties.lineId,
        laneIndex: feature.properties.laneIndex,
        laneCount: feature.properties.laneCount,
        laneOffset: feature.properties.laneOffset
    }));
    const visible = featureCollection.features.filter(feature => feature.properties.lineId !== 'district');

    assert.deepEqual(before.map(value => value.laneOffset), [-1.5, -0.5, 0.5, 1.5]);
    assert.deepEqual(visible.map(feature => feature.properties.laneOffset), [-1.5, 0.5, 1.5]);
    assert.equal(visible.every(feature => feature.properties.laneCount === 4), true);
});

test('alignment assignment merges geometrically equivalent paths across relations', () => {
    const records = assignLondonAlignmentIds([
        corridorRecord({
            alignmentId: undefined,
            sourceAlignmentId: 'osm-relation-1:path-1'
        }),
        corridorRecord({
            alignmentId: undefined,
            sourceAlignmentId: 'osm-relation-2:path-1',
            lineId: 'metropolitan',
            coordinates: [[-0.12, 51.50001], [-0.11, 51.50001]]
        })
    ]);

    assert.equal(records[0].alignmentId, records[1].alignmentId);
});

test('alignment assignment separates materially different paths with the same endpoints', () => {
    const records = assignLondonAlignmentIds([
        corridorRecord({
            alignmentId: undefined,
            sourceAlignmentId: 'osm-relation-1:path-1'
        }),
        corridorRecord({
            alignmentId: undefined,
            sourceAlignmentId: 'osm-relation-2:path-1',
            lineId: 'metropolitan',
            coordinates: [[-0.12, 51.5], [-0.115, 51.505], [-0.11, 51.5]]
        })
    ], { maxMeanDistanceKm: 0.01, maxDistanceKm: 0.02 });

    assert.notEqual(records[0].alignmentId, records[1].alignmentId);
});

test('alignment equivalence is direction independent', () => {
    assert.equal(areLondonCorridorAlignmentsEquivalent(
        [[-0.12, 51.5], [-0.11, 51.5]],
        [[-0.11, 51.5], [-0.12, 51.5]]
    ), true);
});
