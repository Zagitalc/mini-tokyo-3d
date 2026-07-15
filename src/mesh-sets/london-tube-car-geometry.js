import {BufferAttribute, BufferGeometry} from 'three';

export const LONDON_TUBE_CAB_PROFILE = Object.freeze({
    panelDepth: 0.006,
    windowDepth: 0.002,
    layerGap: 0.001
});

const LONDON_TUBE_NOMINAL_LENGTH = 1.28;
const bodyHalfLength = LONDON_TUBE_NOMINAL_LENGTH / 2;
const panelCentreDistance = bodyHalfLength + LONDON_TUBE_CAB_PROFILE.layerGap + LONDON_TUBE_CAB_PROFILE.panelDepth / 2;
const panelOuterDistance = panelCentreDistance + LONDON_TUBE_CAB_PROFILE.panelDepth / 2;
const windowCentreDistance = panelOuterDistance + LONDON_TUBE_CAB_PROFILE.layerGap + LONDON_TUBE_CAB_PROFILE.windowDepth / 2;
const renderedHalfLength = windowCentreDistance + LONDON_TUBE_CAB_PROFILE.windowDepth / 2;

export const LONDON_TUBE_MARKER_PROFILE = Object.freeze({
    totalLength: LONDON_TUBE_NOMINAL_LENGTH,
    renderedLength: renderedHalfLength * 2,
    width: 0.32,
    height: 0.28,
    carriageCount: 3,
    carriageLength: 0.40,
    carriageGap: 0.04,
    carriageStep: 0.44,
    carriageCentres: Object.freeze([-0.44, 0, 0.44]),
    windowLength: 0.23,
    windowHeight: 0.055,
    lineBandHeight: 0.014,
    chassisWidth: 0.20,
    chassisLength: 0.27,
    chassisHeight: 0.04,
    bogieWidth: 0.21,
    bogieLength: 0.055,
    bogieHeight: 0.024,
    cabPanelWidth: 0.25,
    cabPanelHeight: 0.165,
    cabWindowWidth: 0.16,
    cabWindowHeight: 0.055,
    outlineWidth: 0.34,
    outlineLength: 1.32,
    outlineHeight: 0.30,
    outlinePadding: 0.03
});

export const LONDON_TUBE_PART = Object.freeze({
    BODY: 0,
    WINDOWS: 1,
    LINE_DETAIL: 2,
    CHASSIS: 3,
    CAB_RED: 4
});

export default class extends BufferGeometry {

    constructor() {
        super();

        const positions = [];
        const normals = [];
        const uvs = [];
        const groupIndices = [];
        const partRoles = [];
        const indices = [];

        const addVertex = (position, normal, uv, partRole) => {
            positions.push(...position);
            normals.push(...normal);
            uvs.push(...uv);
            groupIndices.push(0);
            partRoles.push(partRole);
            return positions.length / 3 - 1;
        };
        const addQuad = (a, b, c, d, normal, partRole) => {
            const offset = positions.length / 3;
            addVertex(a, normal, [0, 0], partRole);
            addVertex(b, normal, [1, 0], partRole);
            addVertex(c, normal, [1, 1], partRole);
            addVertex(d, normal, [0, 1], partRole);
            indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        };
        const addTriangle = (a, b, c, normal, partRole) => {
            const offset = positions.length / 3;
            addVertex(a, normal, [0.5, 0.5], partRole);
            addVertex(b, normal, [0, 0], partRole);
            addVertex(c, normal, [1, 0], partRole);
            indices.push(offset, offset + 1, offset + 2);
        };
        const addBox = ({width, length, height, x = 0, y = 0, z = 0, partRole}) => {
            const x0 = x - width / 2;
            const x1 = x + width / 2;
            const y0 = y - length / 2;
            const y1 = y + length / 2;
            const z0 = z - height / 2;
            const z1 = z + height / 2;

            addQuad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], partRole);
            addQuad([x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [1, 0, 0], partRole);
            addQuad([x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [0, -1, 0], partRole);
            addQuad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], partRole);
            addQuad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], partRole);
            addQuad([x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1], [0, 0, 1], partRole);
        };
        const addRoundedBody = y => {
            const halfWidth = 0.15;
            const halfHeight = 0.11;
            const chamfer = 0.035;
            const z = 0.03;
            const y0 = y - LONDON_TUBE_MARKER_PROFILE.carriageLength / 2;
            const y1 = y + LONDON_TUBE_MARKER_PROFILE.carriageLength / 2;
            const ring = [
                [-halfWidth + chamfer, z - halfHeight],
                [halfWidth - chamfer, z - halfHeight],
                [halfWidth, z - halfHeight + chamfer],
                [halfWidth, z + halfHeight - chamfer],
                [halfWidth - chamfer, z + halfHeight],
                [-halfWidth + chamfer, z + halfHeight],
                [-halfWidth, z + halfHeight - chamfer],
                [-halfWidth, z - halfHeight + chamfer]
            ];

            for (let index = 0; index < ring.length; index++) {
                const next = (index + 1) % ring.length;
                const [x0, z0] = ring[index];
                const [x1, z1] = ring[next];
                const normalLength = Math.hypot(x0 + x1, z0 + z1 - z * 2) || 1;
                const normal = [(x0 + x1) / normalLength, 0, (z0 + z1 - z * 2) / normalLength];

                addQuad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], normal, LONDON_TUBE_PART.BODY);
                addTriangle([0, y0, z], [x1, y0, z1], [x0, y0, z0], [0, -1, 0], LONDON_TUBE_PART.BODY);
                addTriangle([0, y1, z], [x0, y1, z0], [x1, y1, z1], [0, 1, 0], LONDON_TUBE_PART.BODY);
            }
        };

        for (const centre of LONDON_TUBE_MARKER_PROFILE.carriageCentres) {
            addRoundedBody(centre);
            for (const side of [-1, 1]) {
                addBox({width: 0.01, length: LONDON_TUBE_MARKER_PROFILE.windowLength, height: LONDON_TUBE_MARKER_PROFILE.windowHeight, x: side * 0.155, y: centre, z: 0.065, partRole: LONDON_TUBE_PART.WINDOWS});
                addBox({width: 0.01, length: 0.36, height: LONDON_TUBE_MARKER_PROFILE.lineBandHeight, x: side * 0.155, y: centre, z: 0.005, partRole: LONDON_TUBE_PART.LINE_DETAIL});
            }
            addBox({width: LONDON_TUBE_MARKER_PROFILE.chassisWidth, length: LONDON_TUBE_MARKER_PROFILE.chassisLength, height: LONDON_TUBE_MARKER_PROFILE.chassisHeight, y: centre, z: -0.105, partRole: LONDON_TUBE_PART.CHASSIS});
            for (const bogieOffset of [-0.11, 0.11]) {
                addBox({width: LONDON_TUBE_MARKER_PROFILE.bogieWidth, length: LONDON_TUBE_MARKER_PROFILE.bogieLength, height: LONDON_TUBE_MARKER_PROFILE.bogieHeight, y: centre + bogieOffset, z: -0.128, partRole: LONDON_TUBE_PART.CHASSIS});
            }
        }

        for (const end of [-1, 1]) {
            addBox({width: LONDON_TUBE_MARKER_PROFILE.cabPanelWidth, length: LONDON_TUBE_CAB_PROFILE.panelDepth, height: LONDON_TUBE_MARKER_PROFILE.cabPanelHeight, y: end * panelCentreDistance, z: 0.03, partRole: LONDON_TUBE_PART.CAB_RED});
            addBox({width: LONDON_TUBE_MARKER_PROFILE.cabWindowWidth, length: LONDON_TUBE_CAB_PROFILE.windowDepth, height: LONDON_TUBE_MARKER_PROFILE.cabWindowHeight, y: end * windowCentreDistance, z: 0.065, partRole: LONDON_TUBE_PART.WINDOWS});
        }

        this.setIndex(indices);
        this.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
        this.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
        this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
        this.setAttribute('groupIndex', new BufferAttribute(new Float32Array(groupIndices), 1));
        this.setAttribute('partRole', new BufferAttribute(new Float32Array(partRoles), 1));
        this.computeBoundingBox();
        this.computeBoundingSphere();
    }
}
