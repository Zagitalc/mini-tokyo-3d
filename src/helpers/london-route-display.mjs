import nearestPointOnLine from '@turf/nearest-point-on-line';
import along from '@turf/along';
import lineSliceAlong from '@turf/line-slice-along';
import turfDistance from '@turf/distance';
import turfLength from '@turf/length';
import {lineString, point} from '@turf/helpers';

const DEFAULT_MAX_STATION_DISTANCE_KM = 0.2;
const DEFAULT_MAX_CORRIDOR_DETOUR_RATIO = 4;
const DEFAULT_MAX_JOIN_DISTANCE_KM = 0.25;
export const LONDON_LINE_ORDER = [
    'bakerloo',
    'central',
    'circle',
    'district',
    'hammersmith-city',
    'jubilee',
    'metropolitan',
    'northern',
    'piccadilly',
    'victoria',
    'waterloo-city'
];

function isCoordinate(coord) {
    return Array.isArray(coord) && coord.length >= 2 &&
        Number.isFinite(coord[0]) && Number.isFinite(coord[1]);
}

function cleanLineCoordinates(coords) {
    const cleaned = [];

    for (const coord of coords || []) {
        if (!isCoordinate(coord)) continue;
        const normalized = [Number(coord[0]), Number(coord[1])];
        const previous = cleaned[cleaned.length - 1];

        if (!previous || previous[0] !== normalized[0] || previous[1] !== normalized[1]) {
            cleaned.push(normalized);
        }
    }
    return cleaned;
}

function endpointDistance(line1, atStart1, line2, atStart2) {
    const coord1 = line1[atStart1 ? 0 : line1.length - 1];
    const coord2 = line2[atStart2 ? 0 : line2.length - 1];

    return turfDistance(point(coord1), point(coord2));
}

export function stitchOsmRelationParts(parts, maxJoinDistanceKm = DEFAULT_MAX_JOIN_DISTANCE_KM) {
    const remaining = (parts || [])
        .map(cleanLineCoordinates)
        .filter(coords => coords.length >= 2);

    if (!remaining.length) return [];

    let stitched = remaining.shift().slice();

    while (remaining.length) {
        let best = null;

        for (let index = 0; index < remaining.length; index++) {
            const candidate = remaining[index];
            const joins = [
                {distance: endpointDistance(stitched, false, candidate, true), prepend: false, reverse: false},
                {distance: endpointDistance(stitched, false, candidate, false), prepend: false, reverse: true},
                {distance: endpointDistance(stitched, true, candidate, false), prepend: true, reverse: false},
                {distance: endpointDistance(stitched, true, candidate, true), prepend: true, reverse: true}
            ];

            for (const join of joins) {
                if (!best || join.distance < best.distance) {
                    best = {...join, index};
                }
            }
        }

        if (!best || best.distance > maxJoinDistanceKm) break;

        let next = remaining.splice(best.index, 1)[0];
        if (best.reverse) next = next.slice().reverse();

        if (best.prepend) {
            stitched = next.slice(0, -1).concat(stitched);
        } else {
            stitched = stitched.concat(next.slice(1));
        }
    }

    return stitched;
}

function getRelationIdentity(feature, index) {
    const properties = (feature && feature.properties) || {};
    const rawId = properties['@id'] || properties.id || properties.osm_id || `feature-${index}`;
    return String(rawId).replace(/^relation\//, 'osm-relation-');
}

export function collectOsmRelationCandidates(geojson) {
    const candidates = [];

    for (const [index, feature] of ((geojson && geojson.features) || []).entries()) {
        const geometry = feature && feature.geometry;
        const properties = (feature && feature.properties) || {};

        if (!geometry || properties.route !== 'subway') continue;

        const parts = geometry.type === 'LineString' ?
            [geometry.coordinates] :
            geometry.type === 'MultiLineString' ? geometry.coordinates : [];
        const coordinates = stitchOsmRelationParts(parts);

        if (coordinates.length < 2) continue;

        const relationId = getRelationIdentity(feature, index);
        candidates.push({
            relationId,
            alignmentId: `${relationId}:path-1`,
            coordinates,
            properties
        });
    }

    return candidates;
}

function projectStationCoordinates(line, stationCoords) {
    return stationCoords.map(coord => {
        const nearest = nearestPointOnLine(line, point(coord));
        return {
            offset: nearest.properties.location,
            distance: nearest.properties.dist
        };
    });
}

function countInversions(offsets) {
    let inversions = 0;

    for (let index = 1; index < offsets.length; index++) {
        if (offsets[index] + 1e-6 < offsets[index - 1]) inversions++;
    }
    return inversions;
}

export function projectStationsMonotonically(coordinates, stationCoords, {
    maxStationDistanceKm = DEFAULT_MAX_STATION_DISTANCE_KM
} = {}) {
    const cleanCoordinates = cleanLineCoordinates(coordinates);
    const cleanStations = (stationCoords || []).filter(isCoordinate);

    if (cleanCoordinates.length < 2 || cleanStations.length < 2) {
        return {valid: false, reason: 'insufficient-coordinates'};
    }

    const forwardLine = lineString(cleanCoordinates);
    const forwardProjection = projectStationCoordinates(forwardLine, cleanStations);
    const reverseCoordinates = cleanCoordinates.slice().reverse();
    const reverseProjection = projectStationCoordinates(lineString(reverseCoordinates), cleanStations);
    const forwardInversions = countInversions(forwardProjection.map(value => value.offset));
    const reverseInversions = countInversions(reverseProjection.map(value => value.offset));
    const useReverse = reverseInversions < forwardInversions;
    const projection = useReverse ? reverseProjection : forwardProjection;
    const orientedCoordinates = useReverse ? reverseCoordinates : cleanCoordinates;
    const maxDistance = Math.max(...projection.map(value => value.distance));
    const inversions = Math.min(forwardInversions, reverseInversions);

    return {
        valid: inversions === 0 && maxDistance <= maxStationDistanceKm,
        reason: inversions ? 'non-monotonic-stations' :
        maxDistance > maxStationDistanceKm ? 'station-too-far-from-path' : null,
        coordinates: orientedCoordinates,
        stationOffsets: projection.map(value => value.offset),
        stationDistances: projection.map(value => value.distance),
        inversions,
        reversed: useReverse,
        score: inversions * 1000 + projection.reduce((sum, value) => sum + value.distance, 0)
    };
}

export function matchOsmRelationCandidate(candidates, stationCoords, options) {
    let best = null;

    for (const candidate of candidates || []) {
        const projection = projectStationsMonotonically(candidate.coordinates, stationCoords, options);

        if (!projection.valid) continue;
        if (!best || projection.score < best.projection.score) {
            best = {candidate, projection};
        }
    }

    return best;
}

export function validateLondonCorridorGeometry(coordinates, startCoord, endCoord, {
    maxEndpointDistanceKm = DEFAULT_MAX_STATION_DISTANCE_KM,
    maxDetourRatio = DEFAULT_MAX_CORRIDOR_DETOUR_RATIO
} = {}) {
    const cleanCoordinates = cleanLineCoordinates(coordinates);

    if (cleanCoordinates.length < 2 || !isCoordinate(startCoord) || !isCoordinate(endCoord)) {
        return {valid: false, reason: 'insufficient-coordinates'};
    }

    const startDistance = turfDistance(point(startCoord), point(cleanCoordinates[0]));
    const endDistance = turfDistance(point(endCoord), point(cleanCoordinates[cleanCoordinates.length - 1]));

    if (startDistance > maxEndpointDistanceKm || endDistance > maxEndpointDistanceKm) {
        return {valid: false, reason: 'endpoint-too-far'};
    }

    const directLength = Math.max(turfDistance(point(startCoord), point(endCoord)), 0.001);
    const pathLength = turfLength(lineString(cleanCoordinates));

    if (!Number.isFinite(pathLength) || pathLength > directLength * maxDetourRatio + 0.5) {
        return {valid: false, reason: 'excessive-detour'};
    }

    return {valid: true, coordinates: cleanCoordinates, pathLength, directLength};
}

function clampVector(origin, target, maxLength) {
    const dx = target[0] - origin[0];
    const dy = target[1] - origin[1];
    const length = Math.hypot(dx, dy);

    if (!length || length <= maxLength) return target;
    const factor = maxLength / length;
    return [origin[0] + dx * factor, origin[1] + dy * factor];
}

function cubicBezier(start, control1, control2, end, t) {
    const mt = 1 - t;
    return [
        mt * mt * mt * start[0] + 3 * mt * mt * t * control1[0] +
            3 * mt * t * t * control2[0] + t * t * t * end[0],
        mt * mt * mt * start[1] + 3 * mt * mt * t * control1[1] +
            3 * mt * t * t * control2[1] + t * t * t * end[1]
    ];
}

export function buildTangentClampedFallback(previousCoord, startCoord, endCoord, nextCoord) {
    const previous = isCoordinate(previousCoord) ? previousCoord : startCoord;
    const next = isCoordinate(nextCoord) ? nextCoord : endCoord;
    const directKm = turfDistance(point(startCoord), point(endCoord));
    const directDegrees = Math.hypot(endCoord[0] - startCoord[0], endCoord[1] - startCoord[1]);
    const maxControlLength = directDegrees / 3;
    const rawControl1 = [
        startCoord[0] + (endCoord[0] - previous[0]) / 6,
        startCoord[1] + (endCoord[1] - previous[1]) / 6
    ];
    const rawControl2 = [
        endCoord[0] - (next[0] - startCoord[0]) / 6,
        endCoord[1] - (next[1] - startCoord[1]) / 6
    ];
    const control1 = clampVector(startCoord, rawControl1, maxControlLength);
    const control2 = clampVector(endCoord, rawControl2, maxControlLength);
    const subdivisions = Math.max(4, Math.ceil(directKm / 0.25));
    const coordinates = [];

    for (let index = 0; index <= subdivisions; index++) {
        coordinates.push(cubicBezier(startCoord, control1, control2, endCoord, index / subdivisions));
    }

    return coordinates;
}

export function extractLondonRelationCorridors(match, stationCoords, options = {}) {
    if (!match || !match.projection || !match.candidate) return [];

    const {projection, candidate} = match;
    const line = lineString(projection.coordinates);
    const corridors = [];

    for (let index = 0; index < stationCoords.length - 1; index++) {
        const startCoord = stationCoords[index];
        const endCoord = stationCoords[index + 1];
        const startOffset = projection.stationOffsets[index];
        const endOffset = projection.stationOffsets[index + 1];
        let coordinates = [];

        if (Number.isFinite(startOffset) && Number.isFinite(endOffset) && endOffset > startOffset + 1e-6) {
            coordinates = lineSliceAlong(line, startOffset, endOffset).geometry.coordinates;
            coordinates[0] = startCoord.slice(0, 2);
            coordinates[coordinates.length - 1] = endCoord.slice(0, 2);
        }

        const validation = validateLondonCorridorGeometry(coordinates, startCoord, endCoord, options);
        const useFallback = !validation.valid;

        corridors.push({
            index,
            alignmentId: candidate.alignmentId,
            geometrySource: useFallback ? 'fallback' : 'osm',
            validationReason: useFallback ? validation.reason : null,
            coordinates: useFallback ?
                buildTangentClampedFallback(
                    stationCoords[index - 1],
                    startCoord,
                    endCoord,
                    stationCoords[index + 2]
                ) :
                validation.coordinates
        });
    }

    return corridors;
}

function slugifyIdentity(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/^tfl\./, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export function normalizeLondonCorridorEndpoints(fromGroup, toGroup) {
    const endpoints = [String(fromGroup || ''), String(toGroup || '')].sort();
    return {
        fromGroup: endpoints[0],
        toGroup: endpoints[1],
        reversed: String(fromGroup || '') !== endpoints[0]
    };
}

export function makeLondonCorridorId(fromGroup, toGroup, alignmentId) {
    const normalized = normalizeLondonCorridorEndpoints(fromGroup, toGroup);
    return [
        slugifyIdentity(normalized.fromGroup),
        slugifyIdentity(normalized.toGroup),
        slugifyIdentity(alignmentId)
    ].join('__');
}

function getLineOrderIndex(lineId, lineOrder) {
    const index = lineOrder.indexOf(lineId);
    return index === -1 ? lineOrder.length : index;
}

function compareLineIds(line1, line2, lineOrder) {
    const order1 = getLineOrderIndex(line1, lineOrder);
    const order2 = getLineOrderIndex(line2, lineOrder);
    return order1 - order2 || line1.localeCompare(line2);
}

function selectCanonicalCorridor(records) {
    return records.slice().sort((record1, record2) => {
        const source1 = record1.geometrySource === 'osm' ? 0 : 1;
        const source2 = record2.geometrySource === 'osm' ? 0 : 1;
        const coordinateCount1 = (record1.coordinates || []).length;
        const coordinateCount2 = (record2.coordinates || []).length;

        return source1 - source2 || coordinateCount2 - coordinateCount1 ||
            String(record1.railwayId || '').localeCompare(String(record2.railwayId || ''));
    })[0];
}

export function canonicalizeLondonCorridors(records, {
    lineOrder = LONDON_LINE_ORDER
} = {}) {
    const corridorLookup = new Map();

    for (const record of records || []) {
        if (!record || !record.fromGroup || !record.toGroup || !record.alignmentId || !record.lineId) continue;
        const normalized = normalizeLondonCorridorEndpoints(record.fromGroup, record.toGroup);
        const corridorId = makeLondonCorridorId(
            normalized.fromGroup,
            normalized.toGroup,
            record.alignmentId
        );
        const coordinates = cleanLineCoordinates(record.coordinates);

        if (coordinates.length < 2) continue;
        const orientedRecord = {
            ...record,
            corridorId,
            fromGroup: normalized.fromGroup,
            toGroup: normalized.toGroup,
            coordinates: normalized.reversed ? coordinates.slice().reverse() : coordinates
        };

        if (!corridorLookup.has(corridorId)) corridorLookup.set(corridorId, []);
        corridorLookup.get(corridorId).push(orientedRecord);
    }

    const corridors = [];

    for (const [corridorId, corridorRecords] of corridorLookup) {
        const canonical = selectCanonicalCorridor(corridorRecords);
        const lineLookup = new Map();

        for (const record of corridorRecords) {
            if (!lineLookup.has(record.lineId)) {
                lineLookup.set(record.lineId, {
                    lineId: record.lineId,
                    color: record.color,
                    railwayIds: new Set()
                });
            }
            if (record.railwayId) lineLookup.get(record.lineId).railwayIds.add(record.railwayId);
        }

        const lines = Array.from(lineLookup.values())
            .sort((line1, line2) => compareLineIds(line1.lineId, line2.lineId, lineOrder));
        const laneCount = lines.length;

        corridors.push({
            corridorId,
            alignmentId: canonical.alignmentId,
            fromGroup: canonical.fromGroup,
            toGroup: canonical.toGroup,
            geometrySource: canonical.geometrySource,
            coordinates: canonical.coordinates,
            lines: lines.map((line, laneIndex) => ({
                lineId: line.lineId,
                color: line.color,
                railwayIds: Array.from(line.railwayIds).sort(),
                laneIndex,
                laneCount,
                laneOffset: laneIndex - (laneCount - 1) / 2
            }))
        });
    }

    return corridors.sort((corridor1, corridor2) => corridor1.corridorId.localeCompare(corridor2.corridorId));
}

function sampleLineCoordinates(coordinates, sampleCount = 9) {
    const line = lineString(coordinates);
    const length = turfLength(line);
    const samples = [];

    for (let index = 0; index < sampleCount; index++) {
        samples.push(along(line, length * index / (sampleCount - 1)).geometry.coordinates);
    }
    return {line, length, samples};
}

function getSampleDistances(samples, line) {
    return samples.map(coord => nearestPointOnLine(line, point(coord)).properties.dist);
}

export function areLondonCorridorAlignmentsEquivalent(coordinates1, coordinates2, {
    maxMeanDistanceKm = 0.04,
    maxDistanceKm = 0.09,
    maxLengthRatio = 1.5
} = {}) {
    const clean1 = cleanLineCoordinates(coordinates1);
    const clean2 = cleanLineCoordinates(coordinates2);

    if (clean1.length < 2 || clean2.length < 2) return false;

    const sampled1 = sampleLineCoordinates(clean1);
    const sampled2 = sampleLineCoordinates(clean2);
    const minLength = Math.max(Math.min(sampled1.length, sampled2.length), 0.001);
    const lengthRatio = Math.max(sampled1.length, sampled2.length) / minLength;

    if (lengthRatio > maxLengthRatio) return false;

    const distances = getSampleDistances(sampled1.samples, sampled2.line)
        .concat(getSampleDistances(sampled2.samples, sampled1.line));
    const meanDistance = distances.reduce((sum, value) => sum + value, 0) / distances.length;

    return Math.max(...distances) <= maxDistanceKm && meanDistance <= maxMeanDistanceKm;
}

export function assignLondonAlignmentIds(records, options) {
    const endpointLookup = new Map();
    const output = [];
    const sortedRecords = (records || []).slice().sort((record1, record2) => {
        const source1 = record1.geometrySource === 'osm' ? 0 : 1;
        const source2 = record2.geometrySource === 'osm' ? 0 : 1;
        return source1 - source2 ||
            String(record1.sourceAlignmentId || '').localeCompare(String(record2.sourceAlignmentId || '')) ||
            String(record1.lineId || '').localeCompare(String(record2.lineId || ''));
    });

    for (const record of sortedRecords) {
        const normalized = normalizeLondonCorridorEndpoints(record.fromGroup, record.toGroup);
        const endpointKey = `${normalized.fromGroup}|${normalized.toGroup}`;
        const alignments = endpointLookup.get(endpointKey) || [];
        let alignment = alignments.find(candidate =>
            areLondonCorridorAlignmentsEquivalent(candidate.coordinates, record.coordinates, options)
        );

        if (!alignment) {
            const sourceIdentity = record.sourceAlignmentId || `fallback-${alignments.length + 1}`;
            alignment = {
                alignmentId: `${sourceIdentity}:alignment-${alignments.length + 1}`,
                coordinates: record.coordinates
            };
            alignments.push(alignment);
            endpointLookup.set(endpointKey, alignments);
        }

        output.push({...record, alignmentId: alignment.alignmentId});
    }

    return output;
}

export function buildLondonDisplayFeatureCollection(records, options) {
    const corridors = canonicalizeLondonCorridors(records, options);
    const features = [];

    for (const corridor of corridors) {
        for (const line of corridor.lines) {
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: corridor.coordinates
                },
                properties: {
                    type: 'railway',
                    id: `${corridor.corridorId}__${line.lineId}`,
                    corridorId: corridor.corridorId,
                    alignmentId: corridor.alignmentId,
                    lineId: line.lineId,
                    railwayIds: line.railwayIds,
                    laneIndex: line.laneIndex,
                    laneCount: line.laneCount,
                    laneOffset: line.laneOffset,
                    geometrySource: corridor.geometrySource,
                    color: line.color || '#0098D4'
                }
            });
        }
    }

    return {
        type: 'FeatureCollection',
        features
    };
}
