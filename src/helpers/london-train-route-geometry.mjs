const EARTH_RADIUS_KM = 6371.0088;

function radians(value) {
    return value * Math.PI / 180;
}
function distanceKm(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right)) return Infinity;
    const lat1 = radians(left[1]);
    const lat2 = radians(right[1]);
    const deltaLat = lat2 - lat1;
    const deltaLng = radians(right[0] - left[0]);
    const sinLat = Math.sin(deltaLat / 2);
    const sinLng = Math.sin(deltaLng / 2);
    const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(value)));
}

function stationCoordinate(station) {
    return station && Array.isArray(station.coord) ? station.coord : null;
}

function candidateGeometry(feature, fromCoord, toCoord) {
    const coordinates = feature && feature.geometry && feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const forwardError = distanceKm(fromCoord, first) + distanceKm(toCoord, last);
    const reverseError = distanceKm(fromCoord, last) + distanceKm(toCoord, first);

    return {
        coordinates: forwardError <= reverseError ? coordinates : [...coordinates].reverse(),
        error: Math.min(forwardError, reverseError)
    };
}

function appendCoordinates(target, coordinates) {
    for (const coordinate of coordinates) {
        const previous = target[target.length - 1];
        if (!previous || distanceKm(previous, coordinate) > 0.000001) {
            target.push([...coordinate]);
        }
    }
}

export function buildLondonTrainRouteFeature({
    railway,
    displayFeatures,
    baseFeature,
    maxEndpointErrorKm = 0.8
}) {
    const stations = railway && Array.isArray(railway.stations) ? railway.stations : [];
    if (stations.length < 2 || !baseFeature) return null;

    const candidates = (displayFeatures || []).filter(feature => {
        const railwayIds = feature && feature.properties && feature.properties.railwayIds;
        return Array.isArray(railwayIds) && railwayIds.includes(railway.id);
    });
    const coordinates = [];
    const stationOffsets = [0];
    const corridorSources = [];
    let travelled = 0;

    for (let index = 0; index < stations.length - 1; index++) {
        const fromCoord = stationCoordinate(stations[index]);
        const toCoord = stationCoordinate(stations[index + 1]);
        if (!fromCoord || !toCoord) return null;

        let best = null;
        let bestFeature = null;
        for (const feature of candidates) {
            const match = candidateGeometry(feature, fromCoord, toCoord);
            if (match && (!best || match.error < best.error)) {
                best = match;
                bestFeature = feature;
            }
        }

        const useDisplay = best && best.error <= maxEndpointErrorKm;
        const segment = useDisplay ? best.coordinates : [fromCoord, toCoord];
        const startIndex = coordinates.length ? coordinates.length - 1 : 0;
        appendCoordinates(coordinates, segment);
        for (let coordIndex = Math.max(1, startIndex + 1); coordIndex < coordinates.length; coordIndex++) {
            travelled += distanceKm(coordinates[coordIndex - 1], coordinates[coordIndex]);
        }
        stationOffsets.push(travelled);
        corridorSources.push({
            fromStationId: stations[index].id,
            toStationId: stations[index + 1].id,
            geometrySource: useDisplay ? 'display' : 'fallback',
            corridorId: useDisplay ? bestFeature.properties.corridorId : null
        });
    }

    return {
        feature: {
            ...baseFeature,
            geometry: {
                ...baseFeature.geometry,
                type: 'LineString',
                coordinates
            },
            properties: {
                ...baseFeature.properties,
                length: travelled,
                'station-offsets': stationOffsets,
                'london-display-aligned': true
            }
        },
        corridorSources
    };
}
