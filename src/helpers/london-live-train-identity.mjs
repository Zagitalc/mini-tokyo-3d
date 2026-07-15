export const MIN_IDENTITY_SCORE = 60;
export const IDENTITY_AMBIGUITY_MARGIN = 15;

function compatibleValue(left, right) {
    return !left || !right || String(left).toLowerCase() === String(right).toLowerCase();
}

function getStateEta(state) {
    return Number.isFinite(state.lastTimeToStation) ? state.lastTimeToStation : state.timeToStation;
}

export function createLondonSyntheticTrainId(sessionId, counter) {
    return `london-synthetic-${sessionId}-${counter}`;
}

export function scoreLondonTrainIdentity(state, observation) {
    if (!state || !observation || state.lineId !== observation.lineId) return null;
    if (!compatibleValue(state.direction, observation.direction)) return null;

    const stateSection = state.sectionIndex;
    const observationSection = observation.sectionIndex;
    const stateStation = state.stationId;
    const observationStation = observation.stationId;
    const stateEta = getStateEta(state);
    const observationEta = observation.timeToStation;
    let score = 0;

    if (state.routeId && observation.routeId && state.routeId === observation.routeId) {
        score += 40;
    }

    if (stateStation && observationStation && stateStation === observationStation) {
        score += 35;
    } else if (Number.isFinite(stateSection) && Number.isFinite(observationSection)) {
        const sectionDistance = Math.abs(stateSection - observationSection);

        if (sectionDistance > 1) return null;
        score += sectionDistance === 0 ? 35 : 20;
    }

    if (Number.isFinite(stateEta) && Number.isFinite(observationEta)) {
        const etaDifference = Math.abs(stateEta - observationEta);

        if (etaDifference > 60) return null;
        if (etaDifference <= 15) {
            score += 15;
        } else if (etaDifference <= 30) {
            score += 10;
        }
    }

    if (state.destination && observation.destination && compatibleValue(state.destination, observation.destination)) {
        score += 10;
    }
    if (state.platform && observation.platform && compatibleValue(state.platform, observation.platform)) {
        score += 5;
    }

    return score;
}

function allocateSyntheticMatch(observation, context, matches, nextCounter, diagnosticCode) {
    const syntheticId = createLondonSyntheticTrainId(context.sessionId || 'session', nextCounter);

    matches.push({
        observation,
        state: null,
        trainKey: syntheticId,
        syntheticId,
        identityConfidence: 0,
        diagnosticCode
    });
    return nextCounter + 1;
}

export function matchObservationsToTrainStates(previousStates, observations, context = {}) {
    const states = previousStates instanceof Map ? [...previousStates.values()] : [...(previousStates || [])];
    const matches = [];
    const diagnostics = [];
    const assignedStates = new Set();
    const pending = [];
    let nextSyntheticCounter = Number.isFinite(context.syntheticCounter) ? context.syntheticCounter : 1;

    for (const observation of observations || []) {
        if (observation.vehicleId) {
            const state = states.find(candidate =>
                !assignedStates.has(candidate) &&
                candidate.lineId === observation.lineId &&
                candidate.vehicleId === observation.vehicleId
            );
            const trainKey = state ? state.trainKey : `${observation.lineId}|${observation.vehicleId}`;

            if (state) assignedStates.add(state);
            matches.push({
                observation,
                state: state || null,
                trainKey,
                syntheticId: (state && state.syntheticId) || '',
                identityConfidence: 1,
                diagnosticCode: null
            });
        } else {
            const candidates = states
                .filter(state => !assignedStates.has(state) && !state.vehicleId)
                .map(state => ({state, score: scoreLondonTrainIdentity(state, observation)}))
                .filter(candidate => candidate.score !== null)
                .sort((a, b) => b.score - a.score);

            pending.push({observation, candidates});
        }
    }

    pending.sort((a, b) =>
        (b.candidates[0] ? b.candidates[0].score : -1) -
        (a.candidates[0] ? a.candidates[0].score : -1)
    );

    for (const {observation, candidates: originalCandidates} of pending) {
        const candidates = originalCandidates.filter(candidate => !assignedStates.has(candidate.state));
        const best = candidates[0];
        const second = candidates[1];
        let diagnosticCode = null;

        if (!best || best.score < MIN_IDENTITY_SCORE) {
            diagnosticCode = 'identity-below-threshold';
        } else if (second && best.score - second.score < IDENTITY_AMBIGUITY_MARGIN) {
            diagnosticCode = 'ambiguous-identity';
        }

        if (diagnosticCode) {
            nextSyntheticCounter = allocateSyntheticMatch(
                observation,
                context,
                matches,
                nextSyntheticCounter,
                diagnosticCode
            );
            diagnostics.push({code: diagnosticCode, observationId: observation.observationId});
            continue;
        }

        assignedStates.add(best.state);
        matches.push({
            observation,
            state: best.state,
            trainKey: best.state.trainKey,
            syntheticId: best.state.syntheticId,
            identityConfidence: Math.min(1, best.score / 100),
            diagnosticCode: null
        });
    }

    return {
        matches,
        unmatchedStates: states.filter(state => !assignedStates.has(state)),
        diagnostics,
        nextSyntheticCounter
    };
}
