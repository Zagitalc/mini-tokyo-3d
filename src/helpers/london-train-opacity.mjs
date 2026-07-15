export const LONDON_TRAIN_OPACITY = Object.freeze({
    focused: 0.96,
    secondary: 0.82,
    searchDimmed: 0.10
});

export function composeLondonTrainOpacity({
    lifecycleOpacity = 1,
    viewModeOpacity = 1,
    searchModeOpacity = 1
}) {
    return lifecycleOpacity * viewModeOpacity * searchModeOpacity;
}

export function getLondonTrainOpacityTargets(viewMode, searchMode) {
    const searchModeOpacity = searchMode !== 'none' && searchMode !== 'edit'
        ? LONDON_TRAIN_OPACITY.searchDimmed
        : 1;
    const groundViewOpacity = viewMode === 'underground'
        ? LONDON_TRAIN_OPACITY.secondary
        : LONDON_TRAIN_OPACITY.focused;
    const undergroundViewOpacity = viewMode === 'underground'
        ? LONDON_TRAIN_OPACITY.focused
        : LONDON_TRAIN_OPACITY.secondary;

    return {
        ground: composeLondonTrainOpacity({
            viewModeOpacity: groundViewOpacity,
            searchModeOpacity
        }),
        underground: composeLondonTrainOpacity({
            viewModeOpacity: undergroundViewOpacity,
            searchModeOpacity
        })
    };
}
