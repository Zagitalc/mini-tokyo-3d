export function normalizeCustomAttributions(...inputs) {
    const attributions = [];
    const seen = new Set();

    const append = value => {
        if (Array.isArray(value)) {
            for (const entry of value) {
                append(entry);
            }
        } else if (typeof value === 'string' && value.trim() && !seen.has(value)) {
            seen.add(value);
            attributions.push(value);
        }
    };

    for (const input of inputs) {
        append(input);
    }

    return attributions;
}
