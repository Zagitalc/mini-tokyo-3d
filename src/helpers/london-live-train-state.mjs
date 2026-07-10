import {matchObservationsToTrainStates} from './london-live-train-identity.mjs';
import {normalizeTfLObservations} from './london-live-train-observations.mjs';

export const STALE_EXTRAPOLATE_MS = 30000;
export const STALE_FREEZE_MS = 90000;
export const DWELL_MIN_MS = 10000;
export const DWELL_MAX_MS = 45000;
export const MAX_BACKWARD_PROGRESS_CORRECTION = 0.02;
export const MAX_FORWARD_PROGRESS_CORRECTION = 0.15;
export const ROUTE_SWITCH_SCORE_MARGIN = 100;
export const ROUTE_SWITCH_CONFIRMATION_POLLS = 2;

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function sameValue(left, right) {
    return (left || '') === (right || '');
}

function isMateriallyNew(previousState, observation) {
    if (!previousState) return true;

    return !sameValue(previousState.direction, observation.direction) ||
        !sameValue(previousState.destination, observation.destination) ||
        !sameValue(previousState.platform, observation.platform) ||
        !sameValue(previousState.stationId, observation.stationId) ||
        !sameValue(previousState.routeId, observation.routeId || previousState.routeId) ||
        previousState.sectionIndex !== observation.sectionIndex ||
        previousState.sectionProgress !== observation.sectionProgress ||
        previousState.lastTimeToStation !== observation.timeToStation;
}

function hasProgressionEvidence(previousState, observation) {
    if (!previousState) return true;
    if (observation.hasProgressionEvidence) return true;
    if (observation.routeId && observation.routeId !== previousState.routeId) return true;
    if (Number.isFinite(observation.sectionIndex) && observation.sectionIndex !== previousState.sectionIndex) return true;
    if (observation.stationId && observation.stationId !== previousState.stationId) return true;

    return Number.isFinite(observation.sectionProgress) &&
        observation.sectionProgress > finiteOr(previousState.sectionProgress, 0) + 0.001;
}

function getRouteTransition(previousState, observation) {
    const requestedRouteId = observation.routeId || previousState.routeId;

    if (!requestedRouteId || requestedRouteId === previousState.routeId) {
        return {
            routeId: previousState.routeId || requestedRouteId,
            pendingRouteId: null,
            pendingRouteLeadCount: 0,
            switched: false,
            diagnosticCode: null
        };
    }

    if (observation.currentRouteInvalid) {
        return {
            routeId: requestedRouteId,
            pendingRouteId: null,
            pendingRouteLeadCount: 0,
            switched: true,
            diagnosticCode: null
        };
    }

    const lead = finiteOr(observation.routeScore, -Infinity) -
        finiteOr(observation.currentRouteScore, -Infinity);

    if (lead < ROUTE_SWITCH_SCORE_MARGIN) {
        return {
            routeId: previousState.routeId,
            pendingRouteId: null,
            pendingRouteLeadCount: 0,
            switched: false,
            diagnosticCode: 'route-switch-insufficient-margin'
        };
    }

    const pendingRouteLeadCount = previousState.pendingRouteId === requestedRouteId ?
        previousState.pendingRouteLeadCount + 1 : 1;

    if (pendingRouteLeadCount >= ROUTE_SWITCH_CONFIRMATION_POLLS && observation.routeBoundary) {
        return {
            routeId: requestedRouteId,
            pendingRouteId: null,
            pendingRouteLeadCount: 0,
            switched: true,
            diagnosticCode: null
        };
    }

    return {
        routeId: previousState.routeId,
        pendingRouteId: requestedRouteId,
        pendingRouteLeadCount,
        switched: false,
        diagnosticCode: 'route-switch-awaiting-confirmation'
    };
}

function getPositionTransition(previousState, observation, routeSwitched) {
    const previousIndex = previousState.sectionIndex;
    const requestedIndex = observation.sectionIndex;
    const previousProgress = finiteOr(previousState.sectionProgress, 0);
    const requestedProgress = finiteOr(observation.sectionProgress, previousProgress);

    if (!Number.isFinite(requestedIndex)) {
        return {
            sectionIndex: previousIndex,
            sectionProgress: previousProgress,
            progressionAccepted: false,
            diagnosticCode: null
        };
    }

    if (!Number.isFinite(previousIndex) || routeSwitched) {
        return {
            sectionIndex: requestedIndex,
            sectionProgress: Math.max(0, Math.min(1, requestedProgress)),
            progressionAccepted: true,
            diagnosticCode: null
        };
    }

    const sectionDelta = requestedIndex - previousIndex;

    if (Math.abs(sectionDelta) > 1) {
        return {
            sectionIndex: previousIndex,
            sectionProgress: previousProgress,
            progressionAccepted: false,
            diagnosticCode: 'jump-multiple-sections'
        };
    }

    if (sectionDelta !== 0) {
        return {
            sectionIndex: requestedIndex,
            sectionProgress: Math.max(0, Math.min(1, requestedProgress)),
            progressionAccepted: true,
            diagnosticCode: null
        };
    }

    if (requestedProgress < previousProgress - MAX_BACKWARD_PROGRESS_CORRECTION) {
        return {
            sectionIndex: previousIndex,
            sectionProgress: previousProgress - MAX_BACKWARD_PROGRESS_CORRECTION,
            progressionAccepted: false,
            diagnosticCode: 'backward-correction-clamped'
        };
    }
    if (requestedProgress > previousProgress + MAX_FORWARD_PROGRESS_CORRECTION) {
        return {
            sectionIndex: previousIndex,
            sectionProgress: previousProgress + MAX_FORWARD_PROGRESS_CORRECTION,
            progressionAccepted: true,
            diagnosticCode: 'forward-correction-clamped'
        };
    }

    return {
        sectionIndex: requestedIndex,
        sectionProgress: Math.max(0, Math.min(1, requestedProgress)),
        progressionAccepted: requestedProgress > previousProgress + 0.001,
        diagnosticCode: null
    };
}

export function createInitialLondonTrainState(match, timestamp) {
    const {observation} = match;
    const positioned = Number.isFinite(observation.sectionIndex);
    const dwelling = observation.atStation || observation.sectionProgress >= 0.99;

    return {
        trainKey: match.trainKey,
        vehicleId: observation.vehicleId || '',
        syntheticId: match.syntheticId || '',
        identityConfidence: match.identityConfidence,
        lineId: observation.lineId,
        direction: observation.direction || '',
        destination: observation.destination || '',
        platform: observation.platform || '',
        stationId: observation.stationId || '',
        routeId: observation.routeId || '',
        pendingRouteId: null,
        pendingRouteLeadCount: 0,
        state: positioned ? dwelling ? 'dwelling' : 'moving' : 'unplaced',
        sectionIndex: observation.sectionIndex,
        sectionProgress: finiteOr(observation.sectionProgress, 0),
        lastValidSectionIndex: observation.sectionIndex,
        lastValidProgress: finiteOr(observation.sectionProgress, 0),
        enteredStationAt: dwelling ? timestamp : null,
        lastObservationAt: timestamp,
        lastFreshEvidenceAt: timestamp,
        lastProgressEvidenceAt: positioned ? timestamp : null,
        lastSuccessfulPollAt: timestamp,
        missingSince: null,
        missingAgeMs: 0,
        lastCoveragePollAt: timestamp,
        coverageWasComplete: true,
        lastTimeToStation: observation.timeToStation,
        rendererToken: null,
        stalePhase: 'none'
    };
}

function transitionMissingState(previousState, pollMeta) {
    const timestamp = pollMeta.timestamp;

    if (!pollMeta.success || !pollMeta.observationsComplete) {
        return {
            state: {
                ...previousState,
                lastCoveragePollAt: timestamp,
                coverageWasComplete: false
            },
            diagnostics: ['poll-failed-no-aging']
        };
    }

    const missingSince = previousState.missingSince === null ? timestamp : previousState.missingSince;
    const elapsed = previousState.missingSince !== null && previousState.coverageWasComplete ?
        Math.max(0, timestamp - previousState.lastCoveragePollAt) : 0;
    const missingAgeMs = previousState.missingAgeMs + elapsed;
    let stalePhase;
    let state;
    let diagnosticCode;

    if (missingAgeMs < STALE_EXTRAPOLATE_MS) {
        stalePhase = 'extrapolate';
        state = 'stale';
        diagnosticCode = 'stale-extrapolating';
    } else if (missingAgeMs < STALE_FREEZE_MS) {
        stalePhase = 'freeze';
        state = 'stale';
        diagnosticCode = 'stale-frozen';
    } else {
        stalePhase = 'remove';
        state = 'expired';
        diagnosticCode = 'stale-expired';
    }

    return {
        state: {
            ...previousState,
            state,
            stalePhase,
            missingSince,
            missingAgeMs,
            lastCoveragePollAt: timestamp,
            coverageWasComplete: true,
            lastSuccessfulPollAt: timestamp
        },
        diagnostics: [diagnosticCode]
    };
}

export function transitionTrainState(previousState, observation, routeCandidates, pollMeta) {
    const timestamp = pollMeta.timestamp;

    if (!observation) return transitionMissingState(previousState, pollMeta);

    if (!previousState || previousState.state === 'expired') {
        return {
            state: createInitialLondonTrainState({
                observation,
                trainKey: pollMeta.trainKey,
                syntheticId: pollMeta.syntheticId,
                identityConfidence: pollMeta.identityConfidence
            }, timestamp),
            diagnostics: []
        };
    }

    const route = getRouteTransition(previousState, observation, routeCandidates);
    const placementObservation = !route.switched && route.routeId !== observation.routeId &&
        observation.currentRouteObservation ? observation.currentRouteObservation : observation;
    const position = getPositionTransition(previousState, placementObservation, route.switched);
    const materiallyNew = isMateriallyNew(previousState, placementObservation);
    const progressionObserved = hasProgressionEvidence(previousState, placementObservation);
    const progressionAccepted = progressionObserved && position.diagnosticCode !== 'jump-multiple-sections';
    const diagnostics = [route.diagnosticCode, position.diagnosticCode].filter(Boolean);
    const isArrival = placementObservation.atStation ||
        (position.sectionProgress >= 0.99 && finiteOr(previousState.sectionProgress, 0) < 0.99);
    let state = previousState.state === 'expired' ? 'unplaced' : previousState.state;
    let enteredStationAt = previousState.enteredStationAt;
    let stalePhase = 'none';
    let acceptPosition = true;

    if (previousState.state === 'dwelling') {
        const dwellElapsed = timestamp - previousState.enteredStationAt;

        if (dwellElapsed >= DWELL_MIN_MS && progressionAccepted && !placementObservation.atStation) {
            state = 'moving';
            enteredStationAt = null;
        } else if (dwellElapsed >= DWELL_MAX_MS && !progressionAccepted) {
            state = 'stale';
            stalePhase = 'freeze';
            diagnostics.push('dwell-max-exceeded');
        } else {
            state = 'dwelling';
            acceptPosition = !progressionAccepted || dwellElapsed >= DWELL_MIN_MS;
        }
    } else if (previousState.state === 'stale' && !progressionAccepted) {
        const progressAge = timestamp - finiteOr(previousState.lastProgressEvidenceAt, timestamp);

        if (progressAge >= STALE_FREEZE_MS) {
            state = 'expired';
            stalePhase = 'remove';
            diagnostics.push('stale-expired');
        } else {
            state = 'stale';
            stalePhase = previousState.stalePhase === 'remove' ? 'freeze' : previousState.stalePhase;
        }
    } else if (isArrival) {
        state = 'dwelling';
        enteredStationAt = timestamp;
    } else if (Number.isFinite(position.sectionIndex)) {
        state = 'moving';
        enteredStationAt = null;
    } else {
        state = 'unplaced';
    }

    const validPosition = position.diagnosticCode !== 'jump-multiple-sections' && acceptPosition;
    const sectionIndex = acceptPosition ? position.sectionIndex : previousState.sectionIndex;
    const sectionProgress = acceptPosition ? position.sectionProgress : previousState.sectionProgress;

    return {
        state: {
            ...previousState,
            vehicleId: observation.vehicleId || previousState.vehicleId,
            identityConfidence: pollMeta.identityConfidence,
            direction: placementObservation.direction || previousState.direction,
            destination: placementObservation.destination || previousState.destination,
            platform: placementObservation.platform || previousState.platform,
            stationId: placementObservation.stationId || previousState.stationId,
            routeId: route.routeId,
            pendingRouteId: route.pendingRouteId,
            pendingRouteLeadCount: route.pendingRouteLeadCount,
            state,
            sectionIndex,
            sectionProgress,
            lastValidSectionIndex: validPosition ? sectionIndex : previousState.lastValidSectionIndex,
            lastValidProgress: validPosition ? sectionProgress : previousState.lastValidProgress,
            enteredStationAt,
            lastObservationAt: timestamp,
            lastFreshEvidenceAt: materiallyNew ? timestamp : previousState.lastFreshEvidenceAt,
            lastProgressEvidenceAt: progressionAccepted && acceptPosition ?
                timestamp : previousState.lastProgressEvidenceAt,
            lastSuccessfulPollAt: timestamp,
            missingSince: null,
            missingAgeMs: 0,
            lastCoveragePollAt: timestamp,
            coverageWasComplete: true,
            lastTimeToStation: placementObservation.timeToStation,
            stalePhase
        },
        diagnostics
    };
}

export function deriveRendererCommand(previousState, nextState) {
    if (!nextState || nextState.state === 'unplaced') return {type: 'none'};
    if (!previousState || previousState.state === 'expired') return {type: 'create'};
    if (nextState.state === 'expired') return {type: 'remove'};
    if (previousState.routeId !== nextState.routeId) return {type: 'rebind'};
    if (nextState.state === 'stale') return {type: 'hold', phase: nextState.stalePhase};
    return {type: 'update'};
}

export function processLiveTrainPoll({
    previousStates,
    linePolls,
    routes,
    timestamp,
    sessionId = 'session',
    syntheticCounter = 1
}) {
    const states = new Map(previousStates || []);
    const commands = [];
    const diagnostics = [];
    let nextSyntheticCounter = syntheticCounter;

    for (const linePoll of linePolls || []) {
        const pollTimestamp = Number.isFinite(linePoll.timestamp) ? linePoll.timestamp : timestamp;
        const lineStates = new Map([...states].filter(([, state]) => state.lineId === linePoll.lineId));

        if (!linePoll.success || !linePoll.observationsComplete) {
            for (const [trainKey, previousState] of lineStates) {
                const result = transitionTrainState(previousState, null, routes, {
                    ...linePoll,
                    timestamp: pollTimestamp
                });

                states.set(trainKey, result.state);
                commands.push({trainKey, ...deriveRendererCommand(previousState, result.state)});
                diagnostics.push(...result.diagnostics.map(code => ({trainKey, code})));
            }
            continue;
        }

        const observations = normalizeTfLObservations(linePoll.observations, {
            lineId: linePoll.lineId,
            timestamp: pollTimestamp
        });
        const identity = matchObservationsToTrainStates(lineStates, observations, {
            sessionId,
            syntheticCounter: nextSyntheticCounter
        });

        nextSyntheticCounter = identity.nextSyntheticCounter;
        diagnostics.push(...identity.diagnostics);
        for (const match of identity.matches) {
            const previousState = match.state;
            const result = transitionTrainState(previousState, match.observation, routes, {
                ...linePoll,
                timestamp: pollTimestamp,
                trainKey: match.trainKey,
                syntheticId: match.syntheticId,
                identityConfidence: match.identityConfidence
            });

            states.set(match.trainKey, result.state);
            commands.push({trainKey: match.trainKey, ...deriveRendererCommand(previousState, result.state)});
            diagnostics.push(...result.diagnostics.map(code => ({trainKey: match.trainKey, code})));
        }

        for (const previousState of identity.unmatchedStates) {
            const result = transitionTrainState(previousState, null, routes, {
                ...linePoll,
                timestamp: pollTimestamp
            });

            states.set(previousState.trainKey, result.state);
            commands.push({trainKey: previousState.trainKey, ...deriveRendererCommand(previousState, result.state)});
            diagnostics.push(...result.diagnostics.map(code => ({trainKey: previousState.trainKey, code})));
        }
    }

    return {states, commands, diagnostics, nextSyntheticCounter};
}
