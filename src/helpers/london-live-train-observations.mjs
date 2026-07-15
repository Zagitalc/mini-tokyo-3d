function cleanString(value) {
    return value === undefined || value === null ? '' : String(value).trim();
}

function finiteNumber(value) {
    const number = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(number) ? number : undefined;
}

function normalizeDirection(value) {
    return cleanString(value).toLowerCase();
}

function getTimeToStation(raw, timestamp) {
    const direct = finiteNumber(raw.timeToStation);

    if (direct !== undefined) return Math.max(0, direct);
    if (!raw.expectedArrival) return undefined;

    const expectedArrival = Date.parse(raw.expectedArrival);

    return Number.isFinite(expectedArrival) ? Math.max(0, (expectedArrival - timestamp) / 1000) : undefined;
}

function isAtStation(raw, currentLocation) {
    return raw.atStation === true || /^at\s+/i.test(currentLocation);
}

function normalizeRecord(raw, {lineId, timestamp}) {
    const currentLocation = cleanString(raw.currentLocation);
    const stationId = cleanString(raw.stationId || raw.naptanId);
    const stationName = cleanString(raw.stationName);
    const sectionIndex = finiteNumber(raw.sectionIndex);
    const sectionProgress = finiteNumber(raw.sectionProgress);

    return {
        raw,
        vehicleId: cleanString(raw.vehicleId),
        lineId: cleanString(lineId || raw.lineId).toLowerCase(),
        direction: normalizeDirection(raw.direction),
        destination: cleanString(raw.destination || raw.destinationName),
        platform: cleanString(raw.platform || raw.platformName),
        routeId: cleanString(raw.routeId),
        routeScore: finiteNumber(raw.routeScore),
        currentRouteScore: finiteNumber(raw.currentRouteScore),
        routeBoundary: raw.routeBoundary === true,
        currentRouteInvalid: raw.currentRouteInvalid === true,
        stationId,
        stationName,
        currentLocation,
        timeToStation: getTimeToStation(raw, timestamp),
        expectedArrival: raw.expectedArrival ? Date.parse(raw.expectedArrival) : undefined,
        sectionIndex,
        sectionProgress: sectionProgress === undefined ? undefined : Math.max(0, Math.min(1, sectionProgress)),
        atStation: isAtStation(raw, currentLocation),
        hasProgressionEvidence: raw.hasProgressionEvidence === true,
        timestamp
    };
}

function aggregateRecords(records, groupId) {
    const sorted = records.slice().sort((a, b) =>
        (a.timeToStation === undefined ? Infinity : a.timeToStation) -
        (b.timeToStation === undefined ? Infinity : b.timeToStation)
    );
    const primary = sorted[0];

    return {
        ...primary,
        observationId: groupId,
        predictions: sorted,
        timeToStation: primary.timeToStation,
        expectedArrival: primary.expectedArrival
    };
}

export function normalizeTfLObservations(raw, context = {}) {
    const timestamp = Number.isFinite(context.timestamp) ? context.timestamp : Date.now();
    const records = (Array.isArray(raw) ? raw : [])
        .filter(Boolean)
        .map(value => normalizeRecord(value, {...context, timestamp}))
        .filter(value => value.lineId && (value.timeToStation !== undefined || value.sectionIndex !== undefined));
    const vehicleGroups = new Map();
    const anonymousGroups = new Map();
    const observations = [];

    for (let index = 0; index < records.length; index++) {
        const record = records[index];

        if (!record.vehicleId) {
            const key = [
                record.lineId,
                record.direction,
                record.destination,
                record.platform,
                record.currentLocation,
                cleanString(record.raw.towards),
                cleanString(record.raw.destinationNaptanId)
            ].join('|');
            const group = anonymousGroups.get(key);

            if (group) {
                group.push(record);
            } else {
                anonymousGroups.set(key, [record]);
            }
            continue;
        }

        const key = `${record.lineId}|${record.vehicleId}`;
        const group = vehicleGroups.get(key);

        if (group) {
            group.push(record);
        } else {
            vehicleGroups.set(key, [record]);
        }
    }

    for (const [key, recordsForVehicle] of vehicleGroups) {
        observations.push(aggregateRecords(recordsForVehicle, key));
    }
    for (const [key, anonymousRecords] of anonymousGroups) {
        const recordsByStation = new Map();

        for (const record of anonymousRecords) {
            const stationKey = record.stationId || record.stationName || 'unknown';
            const stationRecords = recordsByStation.get(stationKey);

            if (stationRecords) {
                stationRecords.push(record);
            } else {
                recordsByStation.set(stationKey, [record]);
            }
        }

        const runCount = Math.max(...[...recordsByStation.values()].map(values => values.length));
        const runs = Array.from({length: runCount}, () => []);

        for (const stationRecords of recordsByStation.values()) {
            stationRecords.sort((a, b) =>
                finiteNumber(a.timeToStation) - finiteNumber(b.timeToStation)
            );
            stationRecords.forEach((record, index) => runs[index].push(record));
        }
        runs.forEach((run, index) => {
            observations.push(aggregateRecords(run, `${key}|anonymous-run-${index}`));
        });
    }

    return observations.sort((a, b) => a.observationId.localeCompare(b.observationId));
}
