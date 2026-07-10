export function transactionalRebindLondonTrain({
    train,
    routeId,
    railway,
    sectionIndex,
    sectionLength,
    progress,
    resolveBinding,
    applyBinding
}) {
    if (!train || train.instanceID === undefined) {
        throw new Error('Cannot rebind a train without a renderer instance');
    }
    if (!routeId || !Number.isFinite(sectionIndex) || !Number.isFinite(sectionLength)) {
        throw new Error('Invalid London train route binding');
    }

    const binding = resolveBinding(routeId, railway || train.r);
    const nextProgress = Number.isFinite(progress) ? Math.max(0, Math.min(0.99, progress)) : 0;

    applyBinding({
        instanceID: train.instanceID,
        routeIndex: binding.routeIndex,
        colorIndex: binding.colorIndex,
        sectionIndex,
        nextSectionIndex: sectionIndex + sectionLength,
        progress: nextProgress
    });

    train.r = railway || train.r;
    train.sectionIndex = sectionIndex;
    train.sectionLength = sectionLength;
    train._londonProgress = nextProgress;

    return train;
}
