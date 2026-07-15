import {
    assignLondonAlignmentIds,
    buildLondonDisplayFeatureCollection,
    buildTangentClampedFallback,
    collectOsmRelationCandidates,
    extractLondonRelationCorridors,
    matchOsmRelationCandidate
} from '../helpers/london-route-display.mjs';
import {buildLondonStationGroupIdLookup} from '../helpers/london-stations.mjs';
import {getLondonStationAnchor} from '../helpers/london-geometry.mjs';
import {loadJSON} from './helpers';

const OSM_SLUG_OVERRIDES = {
    hammersmith: 'hammersmithcity'
};

function getRailwaySlug(railway) {
    const slug = String(railway.osmSlug || railway.lineId || railway.id || '')
        .replace(/^tfl\./, '')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .toLowerCase();
    return OSM_SLUG_OVERRIDES[slug] || slug;
}

function buildStationGroupAnchors(stations, stationGroups) {
    const groupIdLookup = buildLondonStationGroupIdLookup(stationGroups);
    const stationsByGroup = new Map();

    for (const station of stations) {
        const group = groupIdLookup.get(station.id) || station.id;
        if (!stationsByGroup.has(group)) stationsByGroup.set(group, []);
        stationsByGroup.get(group).push(station);
    }

    const anchorLookup = new Map();
    for (const [group, groupedStations] of stationsByGroup) {
        anchorLookup.set(group, getLondonStationAnchor(groupedStations));
    }

    return {groupIdLookup, anchorLookup};
}

function getRailwayStationSequence(railway, stationLookup, groupIdLookup, anchorLookup) {
    const groups = [];
    const coordinates = [];

    for (const stationId of railway.stations || []) {
        const station = stationLookup.get(stationId);
        if (!station) continue;
        const group = groupIdLookup.get(stationId) || stationId;
        const coord = anchorLookup.get(group) || station.coord;

        if (!Array.isArray(coord) || groups[groups.length - 1] === group) continue;
        groups.push(group);
        coordinates.push(coord);
    }

    return {groups, coordinates};
}

function buildFallbackCorridors(groups, coordinates, railway, sourceAlignmentId) {
    const corridors = [];

    for (let index = 0; index < coordinates.length - 1; index++) {
        corridors.push({
            fromGroup: groups[index],
            toGroup: groups[index + 1],
            sourceAlignmentId,
            lineId: railway.lineId,
            railwayId: railway.id,
            color: railway.color,
            geometrySource: 'fallback',
            validationReason: 'no-matching-osm-relation',
            coordinates: buildTangentClampedFallback(
                coordinates[index - 1],
                coordinates[index],
                coordinates[index + 1],
                coordinates[index + 2]
            )
        });
    }

    return corridors;
}

export default async function buildLondonRouteDisplay(railways, stations, stationGroups, dataDir) {
    const stationLookup = new Map(stations.map(station => [station.id, station]));
    const {groupIdLookup, anchorLookup} = buildStationGroupAnchors(stations, stationGroups);
    const candidateLookup = new Map();
    const records = [];

    for (const railway of railways) {
        const slug = getRailwaySlug(railway);
        if (!candidateLookup.has(slug)) {
            const geojson = await loadJSON(`${dataDir}/osm-${slug}.geojson`).catch(() => null);
            candidateLookup.set(slug, collectOsmRelationCandidates(geojson));
        }

        const {groups, coordinates} = getRailwayStationSequence(
            railway,
            stationLookup,
            groupIdLookup,
            anchorLookup
        );
        if (coordinates.length < 2) continue;

        const match = matchOsmRelationCandidate(candidateLookup.get(slug), coordinates, {
            maxStationDistanceKm: 0.4
        });

        if (!match) {
            records.push(...buildFallbackCorridors(
                groups,
                coordinates,
                railway,
                `fallback-${railway.lineId}`
            ));
            continue;
        }

        const corridors = extractLondonRelationCorridors(match, coordinates);
        for (const corridor of corridors) {
            records.push({
                fromGroup: groups[corridor.index],
                toGroup: groups[corridor.index + 1],
                sourceAlignmentId: corridor.alignmentId,
                lineId: railway.lineId,
                railwayId: railway.id,
                color: railway.color,
                geometrySource: corridor.geometrySource,
                validationReason: corridor.validationReason,
                coordinates: corridor.coordinates
            });
        }
    }

    const alignedRecords = assignLondonAlignmentIds(records);
    const featureCollection = buildLondonDisplayFeatureCollection(alignedRecords);
    const corridorCount = new Set(
        featureCollection.features.map(feature => feature.properties.corridorId)
    ).size;

    featureCollection.metadata = {
        version: 1,
        corridorCount,
        featureCount: featureCollection.features.length,
        osmFeatureCount: featureCollection.features.filter(
            feature => feature.properties.geometrySource === 'osm'
        ).length,
        fallbackFeatureCount: featureCollection.features.filter(
            feature => feature.properties.geometrySource === 'fallback'
        ).length
    };

    return featureCollection;
}
