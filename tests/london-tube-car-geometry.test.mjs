import assert from 'node:assert/strict';
import test from 'node:test';
import LondonTubeCarGeometry, {
    LONDON_TUBE_MARKER_PROFILE,
    LONDON_TUBE_PART
} from '../src/mesh-sets/london-tube-car-geometry.js';

test('London Tube geometry is a centred three-car 4:1 formation', () => {
    const geometry = new LondonTubeCarGeometry();
    const box = geometry.boundingBox;
    const size = {
        x: box.max.x - box.min.x,
        y: box.max.y - box.min.y,
        z: box.max.z - box.min.z
    };

    assert.ok(Math.abs(size.x - LONDON_TUBE_MARKER_PROFILE.width) < 1e-6);
    assert.ok(Math.abs(size.y - LONDON_TUBE_MARKER_PROFILE.totalLength) < 1e-6);
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
    const vertexCount = geometry.getAttribute('position').count;
    const roles = new Set(geometry.getAttribute('partRole').array);

    for (const attribute of ['normal', 'uv', 'groupIndex', 'partRole']) {
        assert.equal(geometry.getAttribute(attribute).count, vertexCount);
    }
    assert.deepEqual([...roles].sort(), Object.values(LONDON_TUBE_PART).sort());
    assert.ok(geometry.index.count / 3 < 1000);
    assert.ok(vertexCount < 2000);
});

test('London Tube profile defines a complete formation outline', () => {
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlineWidth > LONDON_TUBE_MARKER_PROFILE.width);
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlineLength > LONDON_TUBE_MARKER_PROFILE.totalLength);
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlineHeight > LONDON_TUBE_MARKER_PROFILE.height);
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlinePadding >= 0.025);
    assert.ok(LONDON_TUBE_MARKER_PROFILE.outlinePadding <= 0.035);
});
