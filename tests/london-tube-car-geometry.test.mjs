import assert from 'node:assert/strict';
import test from 'node:test';
import LondonTubeCarGeometry, {
    LONDON_TUBE_CAB_PROFILE,
    LONDON_TUBE_MARKER_PROFILE,
    LONDON_TUBE_PART
} from '../src/mesh-sets/london-tube-car-geometry.js';

const EPSILON = 1e-6;

const getGeometryMetrics = geometry => {
    const vertices = geometry.getAttribute('position').count;
    const triangles = geometry.index ? geometry.index.count / 3 : vertices / 3;

    return {vertices, triangles};
};

const getTriangleDoubledArea = (positions, a, b, c) => {
    const ab = [
        positions[b * 3] - positions[a * 3],
        positions[b * 3 + 1] - positions[a * 3 + 1],
        positions[b * 3 + 2] - positions[a * 3 + 2]
    ];
    const ac = [
        positions[c * 3] - positions[a * 3],
        positions[c * 3 + 1] - positions[a * 3 + 1],
        positions[c * 3 + 2] - positions[a * 3 + 2]
    ];
    const cross = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0]
    ];

    return Math.hypot(...cross);
};

const getRoleAxisBounds = (geometry, role, axis) => {
    const positions = geometry.getAttribute('position').array;
    const roles = geometry.getAttribute('partRole').array;
    let min = Infinity;
    let max = -Infinity;

    for (let vertex = 0; vertex < roles.length; vertex++) {
        if (roles[vertex] === role) {
            const value = positions[vertex * 3 + axis];
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
    }

    return {min, max};
};

test('London Tube geometry is a centred three-car 4:1 formation', () => {
    const geometry = new LondonTubeCarGeometry();
    const box = geometry.boundingBox;
    const size = {
        x: box.max.x - box.min.x,
        y: box.max.y - box.min.y,
        z: box.max.z - box.min.z
    };

    assert.ok(Math.abs(size.x - LONDON_TUBE_MARKER_PROFILE.width) < 1e-6);
    assert.ok(Math.abs(size.y - LONDON_TUBE_MARKER_PROFILE.renderedLength) < EPSILON);
    assert.ok(Math.abs(size.z - LONDON_TUBE_MARKER_PROFILE.height) < 1e-6);
    assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6);
    assert.ok(Math.abs(box.min.y + box.max.y) < 1e-6);
    assert.ok(Math.abs(box.min.z + box.max.z) < 1e-6);
    assert.deepEqual(LONDON_TUBE_MARKER_PROFILE.carriageCentres, [-0.44, 0, 0.44]);
    assert.ok(Math.abs(
        LONDON_TUBE_MARKER_PROFILE.carriageStep - LONDON_TUBE_MARKER_PROFILE.carriageLength - 0.04
    ) < 1e-9);
});

test('London Tube geometry contains every procedural part role within budget', () => {
    const geometry = new LondonTubeCarGeometry();
    const {vertices, triangles} = getGeometryMetrics(geometry);
    const roles = new Set(geometry.getAttribute('partRole').array);

    for (const attribute of ['normal', 'uv', 'groupIndex', 'partRole']) {
        assert.equal(geometry.getAttribute(attribute).count, vertices);
    }
    assert.deepEqual([...roles].sort(), Object.values(LONDON_TUBE_PART).sort());
    assert.ok(vertices < 1128);
    assert.ok(triangles < 540);
    assert.deepEqual({vertices, triangles}, {vertices: 840, triangles: 396});

    const positions = geometry.getAttribute('position').array;
    const normals = geometry.getAttribute('normal').array;
    for (const component of [...positions, ...normals]) {
        assert.ok(Number.isFinite(component));
    }

    const indices = geometry.index.array;
    for (let index = 0; index < indices.length; index += 3) {
        assert.ok(
            getTriangleDoubledArea(positions, indices[index], indices[index + 1], indices[index + 2]) > 1e-10,
            `triangle ${index / 3} is degenerate`
        );
    }
});

test('London Tube cab layers are symmetric and separated along the train axis', () => {
    const geometry = new LondonTubeCarGeometry();
    const bodyOuter = LONDON_TUBE_MARKER_PROFILE.totalLength / 2;
    const panelCentre = bodyOuter + LONDON_TUBE_CAB_PROFILE.layerGap + LONDON_TUBE_CAB_PROFILE.panelDepth / 2;
    const panelInner = panelCentre - LONDON_TUBE_CAB_PROFILE.panelDepth / 2;
    const panelOuter = panelCentre + LONDON_TUBE_CAB_PROFILE.panelDepth / 2;
    const windowCentre = panelOuter + LONDON_TUBE_CAB_PROFILE.layerGap + LONDON_TUBE_CAB_PROFILE.windowDepth / 2;
    const windowInner = windowCentre - LONDON_TUBE_CAB_PROFILE.windowDepth / 2;
    const windowOuter = windowCentre + LONDON_TUBE_CAB_PROFILE.windowDepth / 2;
    const panelBounds = getRoleAxisBounds(geometry, LONDON_TUBE_PART.CAB_RED, 1);
    const cabWindowYs = [];
    const positions = geometry.getAttribute('position').array;
    const roles = geometry.getAttribute('partRole').array;

    for (let vertex = 0; vertex < roles.length; vertex++) {
        const y = positions[vertex * 3 + 1];
        if (roles[vertex] === LONDON_TUBE_PART.WINDOWS && Math.abs(y) > bodyOuter) {
            cabWindowYs.push(y);
        }
    }

    assert.ok(panelInner - bodyOuter >= LONDON_TUBE_CAB_PROFILE.layerGap - EPSILON);
    assert.ok(windowInner - panelOuter >= LONDON_TUBE_CAB_PROFILE.layerGap - EPSILON);
    assert.ok(Math.abs(panelBounds.max - panelCentre - LONDON_TUBE_CAB_PROFILE.panelDepth / 2) <= EPSILON);
    assert.ok(Math.abs(panelBounds.min + panelCentre + LONDON_TUBE_CAB_PROFILE.panelDepth / 2) <= EPSILON);
    assert.ok(Math.abs(Math.max(...cabWindowYs) - windowOuter) <= EPSILON);
    assert.ok(Math.abs(Math.min(...cabWindowYs) + windowOuter) <= EPSILON);
    assert.ok(Math.abs(LONDON_TUBE_MARKER_PROFILE.renderedLength - 1.3) <= EPSILON);
    assert.ok(windowOuter <= LONDON_TUBE_MARKER_PROFILE.outlineLength / 2 + EPSILON);
});

test('London Tube details use the compact no-door-bar profile', () => {
    assert.equal(LONDON_TUBE_MARKER_PROFILE.windowLength, 0.23);
    assert.equal(LONDON_TUBE_MARKER_PROFILE.windowHeight, 0.055);
    assert.equal(LONDON_TUBE_MARKER_PROFILE.lineBandHeight, 0.014);
    assert.equal(LONDON_TUBE_MARKER_PROFILE.chassisWidth, 0.20);
    assert.equal(LONDON_TUBE_MARKER_PROFILE.bogieWidth, 0.21);
    assert.equal(LONDON_TUBE_MARKER_PROFILE.cabPanelWidth, 0.25);
    assert.equal(LONDON_TUBE_MARKER_PROFILE.cabWindowWidth, 0.16);
});

test('London Tube profile defines a complete formation outline', () => {
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlineWidth > LONDON_TUBE_MARKER_PROFILE.width);
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlineLength > LONDON_TUBE_MARKER_PROFILE.totalLength);
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlineHeight > LONDON_TUBE_MARKER_PROFILE.height);
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlinePadding >= 0.025);
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlinePadding <= 0.035);
});
