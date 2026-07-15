export function runLondonLiveTrainReplay({
    fixture,
    processPoll,
    initialStates = new Map(),
    context = {}
}) {
    let states = new Map(initialStates);
    const frames = [];

    for (const poll of fixture.polls || []) {
        const result = processPoll({
            previousStates: states,
            linePolls: poll.linePolls || [],
            routes: context.routes || [],
            timestamp: poll.timestamp,
            context
        });

        states = result.states;
        frames.push({
            timestamp: poll.timestamp,
            states: new Map(states),
            commands: result.commands || [],
            diagnostics: result.diagnostics || []
        });
    }

    return {states, frames};
}
