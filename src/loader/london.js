import nearestPointOnLine from '@turf/nearest-point-on-line';
import turfLength from '@turf/length';
import turfDistance from '@turf/distance';
import lineSliceAlong from '@turf/line-slice-along';
import { lineString, point } from '@turf/helpers';
import {
    getOrderedLondonStationOffsets,
    shouldUseStationOrderGeometry,
    smoothLondonStationLine
} from '../helpers/london-geometry.mjs';
import { updateDistances } from '../helpers/helpers-geojson';
import { loadJSON, saveJSON } from './helpers';
import buildLondonRouteDisplay from './london-route-display';

const DATA_DIR = process.env.MT3D_DATA_DIR || 'data';
const TFL_LINE_COLORS = {
    bakerloo: '#B36305',
    central: '#E32017',
    circle: '#FFD300',
    district: '#00782A',
    'hammersmith-city': '#F3A9BB',
    jubilee: '#A0A5A9',
    metropolitan: '#9B0056',
    northern: '#000000',
    piccadilly: '#003688',
    victoria: '#0098D4',
    'waterloo-city': '#95CDBA'
};

function buildRailDirections(railways) {
    const directions = new Map();

    for (const railway of railways) {
        if (railway.ascending && !directions.has(railway.ascending)) {
            directions.set(railway.ascending, { id: railway.ascending, title: { en: railway.ascending } });
        }
        if (railway.descending && !directions.has(railway.descending)) {
            directions.set(railway.descending, { id: railway.descending, title: { en: railway.descending } });
        }
    }

    return Array.from(directions.values());
}

function buildGeometryLookup(data) {
    if (!data) return new Map();
    if (Array.isArray(data)) {
        return new Map(data.filter(Boolean).map(entry => [entry.id, entry.coordinates || entry.coords || []]));
    }
    if (typeof data === 'object') {
        return new Map(Object.entries(data).map(([id, coordinates]) => [id, coordinates || []]));
    }
    return new Map();
}

function getRailwaySlug(railway) {
    if (!railway) return '';
    if (railway.osmSlug) {
        return String(railway.osmSlug).replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
    }
    const id = railway.geometryId || railway.lineId || railway.id || '';
    const slug = String(id).replace(/^tfl\./, '');
    return slug.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
}

function getRailwayColor(railway) {
    const lineId = String(railway.lineId || railway.id || '')
        .replace(/^tfl\./, '')
        .split('.')[0]
        .toLowerCase();
    const mapped = TFL_LINE_COLORS[lineId];
    const color = String(railway.color || '').trim();

    if (!mapped) {
        return color || '#0098D4';
    }
    if (!color) {
        return mapped;
    }
    if (color.toUpperCase() === '#0098D4' && lineId !== 'victoria') {
        return mapped;
    }
    return color;
}

function extractLineCoordsFromGeoJSON(geojson) {
    if (!geojson || !Array.isArray(geojson.features)) return null;
    let bestCoords = null;
    let bestLength = -1;

    for (const feature of geojson.features) {
        if (!feature || !feature.geometry) continue;
        const { type, coordinates } = feature.geometry;
        if (!coordinates) continue;

        const candidates = [];
        if (type === 'LineString') {
            candidates.push(coordinates);
        } else if (type === 'MultiLineString') {
            for (const line of coordinates) {
                candidates.push(line);
            }
        }
        for (const lineCoords of candidates) {
            if (!Array.isArray(lineCoords) || lineCoords.length < 2) continue;
            const length = turfLength(lineString(lineCoords));
            if (isFinite(length) && length > bestLength) {
                bestLength = length;
                bestCoords = lineCoords;
            }
        }
    }
    return bestCoords;
}

function reorderLineByStations(lineCoords, stationCoords) {
    if (!Array.isArray(lineCoords) || lineCoords.length < 2 || !Array.isArray(stationCoords) || stationCoords.length < 2) {
        return lineCoords;
    }
    const line = lineString(lineCoords);
    const length = turfLength(line);
    if (!isFinite(length) || length <= 0) return lineCoords;

    const stationOffsets = stationCoords.map(coord =>
        nearestPointOnLine(line, point(coord)).properties.location
    );
    // nearestPointOnLine() can return `location === length` for points at the end node.
    // For looped lines that causes lineSliceAlong(startOffset, length) to become a
    // degenerate slice (start == stop) and Turf will throw. Normalize into [0, length).
    let startOffset = stationOffsets[0] ?? 0;
    if (!isFinite(startOffset)) startOffset = 0;
    startOffset = ((startOffset % length) + length) % length;

    const unwrapped = stationOffsets.map(offset =>
        offset >= startOffset ? offset - startOffset : offset - startOffset + length
    );
    let inversions = 0;
    for (let i = 1; i < unwrapped.length; i++) {
        if (unwrapped[i] < unwrapped[i - 1]) inversions++;
    }
    const shouldReverse = inversions > unwrapped.length / 2;

    const looped = turfDistance(point(lineCoords[0]), point(lineCoords[lineCoords.length - 1])) < 0.2;

    let reordered = lineCoords;
    if (looped && startOffset > 0) {
        const first = lineSliceAlong(line, startOffset, length);
        const second = lineSliceAlong(line, 0, startOffset);
        const coords = first.geometry.coordinates.concat(second.geometry.coordinates.slice(1));
        reordered = coords;
    }

    if (shouldReverse) {
        reordered = reordered.slice().reverse();
    }

    return reordered;
}

function buildFeatures(railways, stationLookup, geometryLookup) {
    const features = [];

    for (const railway of railways) {
        const coords = [];
        const stationCoords = [];

        for (const stationId of railway.stations || []) {
            const station = stationLookup.get(stationId);
            if (!station || !Array.isArray(station.coord)) continue;
            coords.push(station.coord);
            stationCoords.push(station.coord);
        }

        const geometryKey = railway.geometryId || railway.id;
        const geometryCoords = geometryLookup && geometryLookup.get(geometryKey);
        const baseLineCoords = Array.isArray(geometryCoords) && geometryCoords.length >= 2
            ? geometryCoords
            : coords;

        if (baseLineCoords.length < 2) continue;

        let lineCoords = reorderLineByStations(baseLineCoords, stationCoords);
        let line = lineString(lineCoords);
        let stationOffsets = stationCoords.map(coord =>
            nearestPointOnLine(line, point(coord)).properties.location
        );

        if (shouldUseStationOrderGeometry(stationOffsets, stationCoords)) {
            lineCoords = smoothLondonStationLine(stationCoords);
            line = lineString(lineCoords);
            stationOffsets = stationCoords.map(coord =>
                nearestPointOnLine(line, point(coord)).properties.location
            );
            if (shouldUseStationOrderGeometry(stationOffsets, stationCoords)) {
                lineCoords = stationCoords.slice();
                line = lineString(lineCoords);
                stationOffsets = getOrderedLondonStationOffsets(stationCoords);
            }
        }

        const length = turfLength(line);

        const feature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: lineCoords
            },
            properties: {
                id: railway.id,
                type: 0,
                color: getRailwayColor(railway),
                width: 8,
                altitude: 1,
                length,
                'station-offsets': stationOffsets
            }
        };
        updateDistances(feature);
        features.push(feature);
    }

    return {
        type: 'FeatureCollection',
        features
    };
}

export default async function () {
    const [railways, stations, stationGroups] = await Promise.all([
        loadJSON(`${DATA_DIR}/railways.json`),
        loadJSON(`${DATA_DIR}/stations.json`),
        loadJSON(`${DATA_DIR}/station-groups.json`).catch(() => [])
    ]);
    const geometryData = await loadJSON(`${DATA_DIR}/railway-geometries.json`).catch(() => null);
    const geometryLookup = buildGeometryLookup(geometryData);

    // Fallback: load line geometries from per-line OSM GeoJSON exports if missing.
    for (const railway of railways) {
        const key = railway.geometryId || railway.id;
        if (geometryLookup.has(key)) continue;
        const slug = getRailwaySlug(railway);
        if (!slug) continue;
        const geojson = await loadJSON(`${DATA_DIR}/osm-${slug}.geojson`).catch(() => null);
        const coords = extractLineCoordsFromGeoJSON(geojson);
        if (Array.isArray(coords) && coords.length >= 2) {
            geometryLookup.set(key, coords);
        }
    }

    const stationLookup = new Map(stations.map(st => [st.id, st]));
    const featureCollection = buildFeatures(railways, stationLookup, geometryLookup);
    const routeDisplayFeatureCollection = await buildLondonRouteDisplay(
        railways,
        stations,
        stationGroups,
        DATA_DIR
    );
    const railDirections = buildRailDirections(railways);

    saveJSON('build/data/features.json.gz', featureCollection);
    saveJSON('build/data/london-route-display.json.gz', routeDisplayFeatureCollection);
    saveJSON('build/data/rail-directions.json.gz', railDirections);
    saveJSON('build/data/station-groups.json.gz', stationGroups);
    saveJSON('build/data/train-types.json.gz', []);
    saveJSON('build/data/train-vehicles.json.gz', []);
}
