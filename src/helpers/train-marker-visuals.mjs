export const TRAIN_MARKER_AXES = Object.freeze({
    width: 'x-lateral',
    height: 'y-longitudinal',
    depth: 'z-vertical'
});

export const DEFAULT_CAR_DIMENSIONS = Object.freeze({
    width: 0.88,
    height: 1.76,
    depth: 0.88
});

export const LONDON_TRAIN_DIMENSIONS = Object.freeze({
    width: 0.32,
    height: 1.28,
    depth: 0.28
});

export const LONDON_TRAIN_SCALE_PROFILE = Object.freeze([
    Object.freeze([9, 0.20]),
    Object.freeze([10, 0.28]),
    Object.freeze([11, 0.38]),
    Object.freeze([12, 0.56]),
    Object.freeze([13, 0.72]),
    Object.freeze([14, 0.80]),
    Object.freeze([15, 0.74]),
    Object.freeze([16, 0.64]),
    Object.freeze([17, 0.56]),
    Object.freeze([18, 0.50]),
    Object.freeze([20, 0.46])
]);

export function resolveCarDimensions(dimensions = DEFAULT_CAR_DIMENSIONS) {
    const resolved = {};

    for (const key of ['width', 'height', 'depth']) {
        const value = dimensions && dimensions[key];

        resolved[key] = Number.isFinite(value) && value > 0 ? value : DEFAULT_CAR_DIMENSIONS[key];
    }
    return resolved;
}

export function getCarGeometryArguments(dimensions) {
    const {width, height, depth} = resolveCarDimensions(dimensions);

    return [width, height, depth];
}

export function getZoomProfileValue(zoom, profile) {
    if (!profile.length) return 1;
    if (zoom <= profile[0][0]) return profile[0][1];
    for (let i = 1; i < profile.length; i++) {
        const [currZoom, currValue] = profile[i];
        const [prevZoom, prevValue] = profile[i - 1];

        if (zoom <= currZoom) {
            const ratio = (zoom - prevZoom) / (currZoom - prevZoom || 1);

            return prevValue + (currValue - prevValue) * ratio;
        }
    }
    return profile[profile.length - 1][1];
}

export function getLondonTrainScaleFactor(zoom) {
    return getZoomProfileValue(zoom, LONDON_TRAIN_SCALE_PROFILE);
}
