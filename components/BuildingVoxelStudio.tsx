import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Copy, Eraser, Eye, EyeOff, MousePointer2, Plus, RotateCcw, Save } from 'lucide-react';
import { BuildingType } from '../types';
import { BuildingsFactory } from '../engine/data/voxels/buildings';
import { BuildingStyleSettings } from '../game/design/buildingStyle';
import { applyBuildingStyleToGroup } from '../game/design/buildingStyleRuntime';
import {
    BUILDING_DETAIL_GRID_STEP,
    BUILDING_DETAIL_PART_SIZE,
    BUILDING_VOXEL_SHAPES,
    BuildingBlueprint,
    BuildingSourceMeshOverride,
    BuildingVoxelPart,
    BuildingVoxelRole,
    BuildingVoxelShape,
    createDefaultBuildingBlueprint,
    createPart,
    dedupeParts,
    DESIGNABLE_BUILDINGS,
    getBuildingDisplayName,
    getVoxelRoleColor,
    loadBuildingBlueprint,
    normalizeSourceMeshOverrides,
    saveBuildingBlueprint,
    snapToDetailGrid,
} from '../game/design/buildingBlueprint';

type StudioTool = 'add' | 'remove' | 'paint' | 'select';

type StudioSceneState = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    rootGroup: THREE.Group;
    baseGroup: THREE.Group;
    editGroup: THREE.Group;
    raycaster: THREE.Raycaster;
    pointer: THREE.Vector2;
    editMeshes: THREE.Mesh[];
    baseHitMeshes: THREE.Object3D[];
    editHitMeshes: THREE.Object3D[];
    hitMeshes: THREE.Object3D[];
    selectedOutline: THREE.BoxHelper;
    orbit: { theta: number; phi: number; radius: number; dragging: boolean; moved: boolean; x: number; y: number };
};

type StudioHit = {
    part?: BuildingVoxelPart;
    sourceMeshId?: string;
    normal: THREE.Vector3;
    point: THREE.Vector3;
};

const ROLE_LABELS: Record<BuildingVoxelRole, string> = {
    wall: 'Wall',
    roof: 'Roof',
    accent: 'Accent',
    greenery: 'Greenery',
};

const SHAPE_LABELS: Record<BuildingVoxelShape, string> = {
    block: 'Block',
    beam: 'Beam',
    wedge: 'Roof Wedge',
    cylinder: 'Cylinder',
    spire: 'Spire',
};

const TOOL_LABELS: Record<StudioTool, string> = {
    select: 'Select',
    add: 'Add',
    remove: 'Hide',
    paint: 'Paint',
};

const PART_GEOMETRY_CACHE = new Map<BuildingVoxelShape, THREE.BufferGeometry>();

interface BuildingVoxelStudioProps {
    settings: BuildingStyleSettings;
}

export const BuildingVoxelStudio: React.FC<BuildingVoxelStudioProps> = ({ settings }) => {
    const [buildingType, setBuildingType] = useState<BuildingType>(BuildingType.STAFF_QUARTERS);
    const [blueprint, setBlueprint] = useState<BuildingBlueprint>(() => loadBuildingBlueprint(BuildingType.STAFF_QUARTERS));
    const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
    const [selectedSourceMeshId, setSelectedSourceMeshId] = useState<string | null>(null);
    const [selectedNormal, setSelectedNormal] = useState<THREE.Vector3Tuple>([0, 1, 0]);
    const [lastHit, setLastHit] = useState<StudioHit | null>(null);
    const [tool, setTool] = useState<StudioTool>('select');
    const [role, setRole] = useState<BuildingVoxelRole>('wall');
    const [shape, setShape] = useState<BuildingVoxelShape>('block');
    const [symmetryEnabled, setSymmetryEnabled] = useState(true);
    const [saved, setSaved] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneStateRef = useRef<StudioSceneState | null>(null);

    const selectedPart = useMemo(
        () => blueprint.parts.find((part) => part.id === selectedPartId) || null,
        [blueprint.parts, selectedPartId],
    );

    const selectedSourceOverride = useMemo(
        () => (blueprint.sourceMeshOverrides || []).find((override) => override.id === selectedSourceMeshId) || null,
        [blueprint.sourceMeshOverrides, selectedSourceMeshId],
    );

    useEffect(() => {
        const next = loadBuildingBlueprint(buildingType);
        setBlueprint(next);
        setSelectedPartId(null);
        setSelectedSourceMeshId(null);
        setLastHit(null);
        setSaved(false);
    }, [buildingType]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#08111f');
        scene.fog = new THREE.Fog('#08111f', 14, 32);

        const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        const rootGroup = new THREE.Group();
        const baseGroup = new THREE.Group();
        const editGroup = new THREE.Group();
        rootGroup.add(baseGroup, editGroup);
        scene.add(rootGroup);

        scene.add(new THREE.HemisphereLight('#dff7ff', '#162030', 1.45));
        const key = new THREE.DirectionalLight('#fff3d7', 2.2);
        key.position.set(5, 8, 4);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        scene.add(key);
        const fill = new THREE.DirectionalLight('#58c7ff', 0.55);
        fill.position.set(-6, 3, -5);
        scene.add(fill);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(18, 18, 18, 18),
            new THREE.MeshStandardMaterial({ color: '#101c2b', roughness: 0.88, metalness: 0.05 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.53;
        floor.receiveShadow = true;
        scene.add(floor);

        const grid = new THREE.GridHelper(18, 72, '#315063', '#183043');
        grid.position.y = -0.51;
        scene.add(grid);

        const selectedOutline = new THREE.BoxHelper(new THREE.Object3D(), '#67e8f9');
        selectedOutline.visible = false;
        scene.add(selectedOutline);

        const state: StudioSceneState = {
            scene,
            camera,
            renderer,
            rootGroup,
            baseGroup,
            editGroup,
            raycaster: new THREE.Raycaster(),
            pointer: new THREE.Vector2(),
            editMeshes: [],
            baseHitMeshes: [],
            editHitMeshes: [],
            hitMeshes: [],
            selectedOutline,
            orbit: { theta: Math.PI * 0.24, phi: Math.PI * 0.32, radius: 9, dragging: false, moved: false, x: 0, y: 0 },
        };
        sceneStateRef.current = state;

        const resize = () => {
            const width = Math.max(1, container.clientWidth);
            const height = Math.max(1, container.clientHeight);
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        const positionCamera = () => {
            const { theta, phi, radius } = state.orbit;
            camera.position.set(
                Math.cos(theta) * Math.cos(phi) * radius,
                Math.sin(phi) * radius + 1.2,
                Math.sin(theta) * Math.cos(phi) * radius,
            );
            camera.lookAt(0, 1.1, 0);
        };

        const onPointerDown = (event: PointerEvent) => {
            state.orbit.dragging = true;
            state.orbit.moved = false;
            state.orbit.x = event.clientX;
            state.orbit.y = event.clientY;
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!state.orbit.dragging) return;
            const dx = event.clientX - state.orbit.x;
            const dy = event.clientY - state.orbit.y;
            state.orbit.x = event.clientX;
            state.orbit.y = event.clientY;
            if (Math.abs(dx) + Math.abs(dy) > 2) state.orbit.moved = true;
            state.orbit.theta -= dx * 0.006;
            state.orbit.phi = Math.max(0.08, Math.min(1.2, state.orbit.phi + dy * 0.004));
            positionCamera();
        };

        const onPointerUp = () => {
            state.orbit.dragging = false;
        };

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            state.orbit.radius = Math.max(3.5, Math.min(18, state.orbit.radius + Math.sign(event.deltaY) * 0.8));
            positionCamera();
        };

        resize();
        positionCamera();
        renderer.setAnimationLoop(() => renderer.render(scene, camera));

        const observer = new ResizeObserver(resize);
        observer.observe(container);
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            observer.disconnect();
            renderer.setAnimationLoop(null);
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            renderer.domElement.removeEventListener('wheel', onWheel);
            disposeEditMeshes(state.editMeshes);
            disposeGroupMeshes(state.baseGroup);
            clearGroup(state.baseGroup);
            renderer.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
            sceneStateRef.current = null;
        };
    }, []);

    useEffect(() => {
        rebuildBasePreview(buildingType, settings, blueprint.sourceMeshOverrides || []);
    }, [buildingType, settings, blueprint.sourceMeshOverrides]);

    useEffect(() => {
        rebuildDetailPreview(blueprint.parts, settings);
    }, [blueprint.parts, settings]);

    const refreshHitMeshes = (state: StudioSceneState): void => {
        state.hitMeshes = [...state.baseHitMeshes, ...state.editHitMeshes];
    };

    const updateSelectedOutline = (activePartId = selectedPartId, activeSourceMeshId = selectedSourceMeshId): void => {
        const state = sceneStateRef.current;
        if (!state) return;

        if (activePartId) {
            const part = blueprint.parts.find((candidate) => candidate.id === activePartId);
            if (part) {
                const proxy = createSelectionProxy(part);
                state.selectedOutline.setFromObject(proxy);
                state.selectedOutline.visible = true;
                disposeSelectionProxy(proxy);
                return;
            }
        }

        const selectedObject = state.hitMeshes.find((object) => {
            const data = object.userData as { sourceMeshId?: string };
            return Boolean(activeSourceMeshId && data.sourceMeshId === activeSourceMeshId);
        });

        if (selectedObject) {
            state.selectedOutline.setFromObject(selectedObject);
            state.selectedOutline.visible = true;
        } else {
            state.selectedOutline.visible = false;
        }
    };

    useEffect(() => {
        updateSelectedOutline();
    }, [selectedPartId, selectedSourceMeshId, blueprint.parts]);

    const rebuildBasePreview = (
        type: BuildingType,
        nextSettings: BuildingStyleSettings,
        sourceOverrides: BuildingSourceMeshOverride[],
    ): void => {
        const state = sceneStateRef.current;
        if (!state) return;

        disposeGroupMeshes(state.baseGroup);
        clearGroup(state.baseGroup);
        state.baseHitMeshes = [];

        const actual = createActualGameBuilding(type, nextSettings);
        const overrideMap = new Map(sourceOverrides.map((override) => [override.id, override]));
        state.baseGroup.add(actual);
        let sourceIndex = 0;
        actual.traverse((object) => {
            if (!(object as THREE.Mesh).isMesh) return;
            const mesh = object as THREE.Mesh;
            const sourceMeshId = `mesh-${sourceIndex++}`;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.sourceMeshId = sourceMeshId;
            mesh.userData.baseBuildingMesh = true;
            applySourceMeshOverride(mesh, overrideMap.get(sourceMeshId));
            if (mesh.visible) state.baseHitMeshes.push(mesh);
        });

        refreshHitMeshes(state);
        updateSelectedOutline();
    };

    const rebuildDetailPreview = (
        parts: BuildingVoxelPart[],
        nextSettings: BuildingStyleSettings,
    ): void => {
        const state = sceneStateRef.current;
        if (!state) return;

        disposeEditMeshes(state.editMeshes);
        for (const mesh of state.editMeshes) state.editGroup.remove(mesh);
        state.editMeshes = [];
        state.editHitMeshes = [];

        const groupedParts = new Map<string, BuildingVoxelPart[]>();
        for (const part of parts) {
            const partShape = part.shape || 'block';
            const key = `${partShape}:${part.role}`;
            const bucket = groupedParts.get(key) || [];
            bucket.push(part);
            groupedParts.set(key, bucket);
        }

        for (const groupParts of groupedParts.values()) {
            const first = groupParts[0];
            const partShape = first.shape || 'block';
            const color = getVoxelRoleColor(first.role, nextSettings);
            const material = new THREE.MeshStandardMaterial({
                color,
                roughness: first.role === 'accent' ? 0.36 : 0.72,
                metalness: first.role === 'accent' ? 0.18 : 0.04,
                emissive: first.role === 'accent' ? new THREE.Color(color) : new THREE.Color('#000000'),
                emissiveIntensity: first.role === 'accent' ? nextSettings.nightGlow * 0.32 : 0,
            });
            const mesh = new THREE.InstancedMesh(createPartGeometry(partShape), material, groupParts.length);
            const partIds: string[] = [];
            groupParts.forEach((part, index) => {
                mesh.setMatrixAt(index, createPartMatrix(part));
                partIds[index] = part.id;
            });
            mesh.instanceMatrix.needsUpdate = true;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.partIds = partIds;
            mesh.userData.instancedDetailParts = true;
            mesh.userData.sharedGeometry = true;
            state.editGroup.add(mesh);
            state.editMeshes.push(mesh);
            state.editHitMeshes.push(mesh);
        }

        refreshHitMeshes(state);
        updateSelectedOutline();
    };

    const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const state = sceneStateRef.current;
        if (!state || state.orbit.moved) return;
        const rect = state.renderer.domElement.getBoundingClientRect();
        state.pointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        state.raycaster.setFromCamera(state.pointer, state.camera);
        const hit = state.raycaster.intersectObjects(state.hitMeshes, false)[0];
        if (!hit) return;

        const normal = hit.face?.normal.clone() || new THREE.Vector3(0, 1, 0);
        normal.transformDirection(hit.object.matrixWorld).round();
        const partIds = hit.object.userData.partIds as string[] | undefined;
        const partId = partIds && hit.instanceId !== undefined
            ? partIds[hit.instanceId]
            : hit.object.userData.partId as string | undefined;
        const sourceMeshId = hit.object.userData.sourceMeshId as string | undefined;
        const hitPart = partId ? blueprint.parts.find((part) => part.id === partId) : undefined;
        const studioHit = { part: hitPart, sourceMeshId, normal, point: hit.point.clone() };
        setLastHit(studioHit);
        setSelectedNormal([normal.x, normal.y, normal.z]);

        if (hitPart) {
            setSelectedPartId(hitPart.id);
            setSelectedSourceMeshId(null);
            if (tool === 'remove') removePart(hitPart.id);
            else if (tool === 'paint') paintPart(hitPart.id, role);
            else if (tool === 'add') addAdjacentPart(hitPart, normal, role);
        } else if (sourceMeshId) {
            setSelectedPartId(null);
            setSelectedSourceMeshId(sourceMeshId);
            if (tool === 'remove') updateSourceMeshOverride(sourceMeshId, { hidden: true });
            else if (tool === 'paint') updateSourceMeshOverride(sourceMeshId, { color: getVoxelRoleColor(role, settings) });
            else if (tool === 'add') addPartAtHit(studioHit, role);
        }
    };

    const addAdjacentPart = (part: BuildingVoxelPart, normal: THREE.Vector3, nextRole = role) => {
        addPart(createPart(
            clampGrid(part.x + Math.round(normal.x) * BUILDING_DETAIL_GRID_STEP, -8, 8),
            clampGrid(part.y + Math.round(normal.y) * BUILDING_DETAIL_GRID_STEP, 0, 12),
            clampGrid(part.z + Math.round(normal.z) * BUILDING_DETAIL_GRID_STEP, -8, 8),
            nextRole,
            shape,
        ));
    };

    const addPartAtHit = (hit: StudioHit, nextRole = role) => {
        const target = hit.point.clone().add(hit.normal.clone().multiplyScalar(BUILDING_DETAIL_GRID_STEP));
        addPart(createPart(
            clampGrid(snapToDetailGrid(target.x), -8, 8),
            clampGrid(snapToDetailGrid(target.y), 0, 12),
            clampGrid(snapToDetailGrid(target.z), -8, 8),
            nextRole,
            shape,
        ));
    };

    const addPart = (part: BuildingVoxelPart) => {
        const additions = symmetryEnabled ? [part, createMirroredPart(part)].filter(Boolean) as BuildingVoxelPart[] : [part];
        setBlueprint((current) => ({ ...current, parts: dedupeParts([...current.parts, ...additions]), updatedAt: Date.now() }));
        setSelectedPartId(part.id);
        setSelectedSourceMeshId(null);
        setSaved(false);
    };

    const removePart = (id = selectedPartId) => {
        if (!id) return;
        setBlueprint((current) => {
            const parts = current.parts.filter((part) => part.id !== id);
            setSelectedPartId(parts[0]?.id || null);
            return { ...current, parts, updatedAt: Date.now() };
        });
        setSaved(false);
    };

    const paintPart = (id = selectedPartId, nextRole = role) => {
        if (!id) return;
        setBlueprint((current) => ({
            ...current,
            parts: current.parts.map((part) => part.id === id ? { ...part, role: nextRole } : part),
            updatedAt: Date.now(),
        }));
        setSaved(false);
    };

    const updatePartTransform = (id: string | null, changes: Partial<BuildingVoxelPart>) => {
        if (!id) return;
        setBlueprint((current) => ({
            ...current,
            parts: dedupeParts(current.parts.map((part) => part.id === id ? { ...part, ...changes } : part)),
            updatedAt: Date.now(),
        }));
        setSaved(false);
    };

    const duplicateSelectedPart = () => {
        if (!selectedPart) return;
        const next = createPart(
            selectedPart.x + BUILDING_DETAIL_GRID_STEP,
            selectedPart.y,
            selectedPart.z,
            selectedPart.role,
            selectedPart.shape || 'block',
        );
        addPart({
            ...next,
            scaleX: selectedPart.scaleX,
            scaleY: selectedPart.scaleY,
            scaleZ: selectedPart.scaleZ,
            rotationY: selectedPart.rotationY,
        });
    };

    const updateSourceMeshOverride = (id: string | null, changes: Partial<BuildingSourceMeshOverride>) => {
        if (!id) return;
        setBlueprint((current) => {
            const existing = (current.sourceMeshOverrides || []).find((override) => override.id === id) || { id };
            const rest = (current.sourceMeshOverrides || []).filter((override) => override.id !== id);
            return {
                ...current,
                sourceMeshOverrides: normalizeSourceMeshOverrides([...rest, { ...existing, ...changes, id }]),
                updatedAt: Date.now(),
            };
        });
        setSelectedSourceMeshId(id);
        setSaved(false);
    };

    const resetSelectedSourceMesh = () => {
        if (!selectedSourceMeshId) return;
        setBlueprint((current) => ({
            ...current,
            sourceMeshOverrides: (current.sourceMeshOverrides || []).filter((override) => override.id !== selectedSourceMeshId),
            updatedAt: Date.now(),
        }));
        setSaved(false);
    };

    const addFromSelected = () => {
        if (selectedPart) addAdjacentPart(selectedPart, new THREE.Vector3(...selectedNormal), role);
        else if (lastHit) addPartAtHit(lastHit, role);
    };

    const handleSave = () => {
        saveBuildingBlueprint(blueprint);
        setSaved(true);
    };

    const handleReset = () => {
        const next = createDefaultBuildingBlueprint(buildingType);
        setBlueprint(next);
        setSelectedPartId(null);
        setSelectedSourceMeshId(null);
        setLastHit(null);
        setSaved(false);
    };

    return (
        <section className="rounded-[6px] border border-cyan-900/50 bg-slate-950 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900 p-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-[0.22em] text-cyan-300">
                        <Box size={14} /> Assembly Studio
                    </div>
                    <h2 className="mt-1 text-2xl font-black font-['Rajdhani'] text-white">{getBuildingDisplayName(buildingType)}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <select
                        value={buildingType}
                        onChange={(event) => setBuildingType(event.target.value as BuildingType)}
                        className="h-10 min-w-56 rounded-[4px] border border-slate-700 bg-slate-950 px-3 text-xs font-black uppercase tracking-wider text-slate-100 outline-none focus:border-cyan-400"
                    >
                        {DESIGNABLE_BUILDINGS.map((type) => (
                            <option key={type} value={type}>{getBuildingDisplayName(type)}</option>
                        ))}
                    </select>
                    <button type="button" onClick={() => setSymmetryEnabled((value) => !value)} className={`h-10 px-3 rounded-[4px] border text-xs font-black uppercase tracking-wider flex items-center gap-2 ${symmetryEnabled ? 'border-cyan-500 bg-cyan-950 text-cyan-100' : 'border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300'}`}>
                        Symmetry {symmetryEnabled ? 'On' : 'Off'}
                    </button>
                    <button type="button" onClick={handleReset} className="h-10 px-3 rounded-[4px] border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-black uppercase tracking-wider flex items-center gap-2">
                        <RotateCcw size={15} /> Reset Design
                    </button>
                    <button type="button" onClick={handleSave} className="h-10 px-3 rounded-[4px] border border-emerald-900 bg-emerald-600 hover:bg-emerald-500 text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Save size={15} /> {saved ? 'Saved' : 'Save Design'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_19rem]">
                <div className="relative h-[34rem] min-h-[24rem] border-b border-slate-800 xl:border-b-0 xl:border-r" onClick={handleCanvasClick}>
                    <div ref={containerRef} className="absolute inset-0" />
                    <div className="pointer-events-none absolute left-4 top-4 rounded-[4px] border border-slate-700 bg-slate-950/80 px-3 py-2 text-[11px] font-bold text-slate-300 backdrop-blur">
                        Pick a part shape, click the building, and grow the design on a {BUILDING_DETAIL_GRID_STEP}m grid.
                    </div>
                    {(selectedPart || selectedSourceMeshId) && (
                        <div className="pointer-events-none absolute bottom-4 left-4 rounded-[4px] border border-cyan-800 bg-slate-950/85 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-cyan-200 backdrop-blur">
                            {selectedPart
                                ? `Edit ${SHAPE_LABELS[selectedPart.shape || 'block']} · ${formatCoord(selectedPart.x)}, ${formatCoord(selectedPart.y)}, ${formatCoord(selectedPart.z)} · ${ROLE_LABELS[selectedPart.role]}`
                                : `Source mesh ${selectedSourceMeshId}`}
                        </div>
                    )}
                </div>

                <div className="space-y-4 bg-slate-900 p-4">
                    <div>
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Tool</div>
                        <div className="grid grid-cols-2 gap-2">
                            {(['select', 'add', 'remove', 'paint'] as StudioTool[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setTool(item)}
                                    className={`h-10 rounded-[4px] border text-[10px] font-black uppercase tracking-wider ${tool === item ? 'border-cyan-400 bg-cyan-950 text-cyan-100' : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                                >
                                    {TOOL_LABELS[item]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Part Palette</div>
                        <div className="grid grid-cols-2 gap-2">
                            {BUILDING_VOXEL_SHAPES.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setShape(item)}
                                    className={`h-12 rounded-[4px] border px-2 text-left text-[10px] font-black uppercase tracking-wider ${shape === item ? 'border-cyan-400 bg-cyan-950 text-cyan-100' : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <span className="mb-1 block text-[9px] text-cyan-300/80">{getShapePreviewGlyph(item)}</span>
                                    {SHAPE_LABELS[item]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Material Role</div>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(ROLE_LABELS) as BuildingVoxelRole[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => {
                                        setRole(item);
                                        if (tool === 'paint') {
                                            if (selectedPartId) paintPart(selectedPartId, item);
                                            if (selectedSourceMeshId) updateSourceMeshOverride(selectedSourceMeshId, { color: getVoxelRoleColor(item, settings) });
                                        }
                                    }}
                                    className={`h-12 rounded-[4px] border px-2 text-left text-[10px] font-black uppercase tracking-wider ${role === item ? 'border-cyan-400 bg-cyan-950 text-cyan-100' : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <span className="mb-1 block h-2 rounded-[2px]" style={{ backgroundColor: getVoxelRoleColor(item, settings) }} />
                                    {ROLE_LABELS[item]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedSourceMeshId && (
                        <div className="rounded-[4px] border border-slate-800 bg-slate-950 p-3">
                            <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Source Mesh</div>
                            <div className="mb-3 truncate text-xs font-black text-cyan-200">{selectedSourceMeshId}</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => updateSourceMeshOverride(selectedSourceMeshId, { hidden: !selectedSourceOverride?.hidden })} className="h-10 rounded-[4px] border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                    {selectedSourceOverride?.hidden ? <Eye size={14} /> : <EyeOff size={14} />} {selectedSourceOverride?.hidden ? 'Show' : 'Hide'}
                                </button>
                                <button type="button" onClick={resetSelectedSourceMesh} className="h-10 rounded-[4px] border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px] font-black uppercase tracking-wider">
                                    Reset
                                </button>
                            </div>
                            <label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Mesh Color
                                <input
                                    type="color"
                                    value={selectedSourceOverride?.color || getVoxelRoleColor(role, settings)}
                                    onChange={(event) => updateSourceMeshOverride(selectedSourceMeshId, { color: event.target.value })}
                                    className="mt-2 h-9 w-full rounded-[4px] border border-slate-700 bg-slate-900 p-1"
                                />
                            </label>
                        </div>
                    )}

                    {selectedPart && (
                        <div className="rounded-[4px] border border-slate-800 bg-slate-950 p-3">
                            <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Detail Transform</div>
                            <div className="mb-3 text-xs font-black text-cyan-200">{SHAPE_LABELS[selectedPart.shape || 'block']}</div>
                            <div className="grid grid-cols-3 gap-2">
                                {(['scaleX', 'scaleY', 'scaleZ'] as const).map((key) => (
                                    <label key={key} className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        {key.replace('scale', '')}
                                        <input
                                            type="number"
                                            min={0.25}
                                            max={6}
                                            step={0.25}
                                            value={selectedPart[key] ?? 1}
                                            onChange={(event) => updatePartTransform(selectedPart.id, { [key]: Number(event.target.value) })}
                                            className="mt-1 h-9 w-full rounded-[4px] border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                                        />
                                    </label>
                                ))}
                            </div>
                            <label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Rotate Y
                                <input
                                    type="range"
                                    min={0}
                                    max={345}
                                    step={15}
                                    value={selectedPart.rotationY ?? 0}
                                    onChange={(event) => updatePartTransform(selectedPart.id, { rotationY: Number(event.target.value) })}
                                    className="mt-2 w-full accent-cyan-400"
                                />
                            </label>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button type="button" onClick={duplicateSelectedPart} className="h-10 rounded-[4px] border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                    <Copy size={14} /> Copy
                                </button>
                                <button type="button" onClick={() => removePart()} className="h-10 rounded-[4px] border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                    <Eraser size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={addFromSelected} className="h-11 rounded-[4px] border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
                            <Plus size={15} /> Add
                        </button>
                        <button type="button" onClick={() => selectedSourceMeshId ? updateSourceMeshOverride(selectedSourceMeshId, { hidden: true }) : removePart()} className="h-11 rounded-[4px] border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
                            <Eraser size={15} /> Remove
                        </button>
                    </div>

                    <div className="rounded-[4px] border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                        <div className="flex items-center gap-2 font-black uppercase tracking-wider text-slate-300"><MousePointer2 size={14} /> Shape Data</div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <span>Base</span><strong className="text-right text-white">Mesh Parts</strong>
                            <span>Hidden/painted</span><strong className="text-right text-white">{blueprint.sourceMeshOverrides?.length || 0}</strong>
                            <span>Fine edits</span><strong className="text-right text-white">{blueprint.parts.length}</strong>
                            <span>Part</span><strong className="text-right text-white">{SHAPE_LABELS[shape]}</strong>
                            <span>Symmetry</span><strong className="text-right text-white">{symmetryEnabled ? 'On' : 'Off'}</strong>
                            <span>Mode</span><strong className="text-right text-white">{TOOL_LABELS[tool]}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

function createActualGameBuilding(type: BuildingType, settings: BuildingStyleSettings): THREE.Group {
    const create = (BuildingsFactory as Record<string, (opts?: Record<string, unknown>) => THREE.Group>)[type];
    const group = create
        ? create({ detailLevel: 'HIGH', integrity: 1, isUnderConstruction: false, level: 1, progress: 1, seed: 7 })
        : new THREE.Group();

    applyBuildingStyleToGroup(type, group, settings);
    const box = new THREE.Box3().setFromObject(group);
    if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        group.position.sub(new THREE.Vector3(center.x, 0, center.z));
    }
    return group;
}

function applySourceMeshOverride(mesh: THREE.Mesh, override?: BuildingSourceMeshOverride): void {
    if (!override) return;
    if (override.hidden) {
        mesh.visible = false;
        return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = materials.map((material) => {
        const next = material.clone() as THREE.Material & { color?: THREE.Color; metalness?: number; roughness?: number };
        if (override.color && next.color) next.color.set(override.color);
        if (override.metalness !== undefined && typeof next.metalness === 'number') next.metalness = override.metalness;
        if (override.roughness !== undefined && typeof next.roughness === 'number') next.roughness = override.roughness;
        next.needsUpdate = true;
        return next;
    });
    if (materials.length === 1) mesh.material = (mesh.material as THREE.Material[])[0];
}

function createPartGeometry(shape: BuildingVoxelShape): THREE.BufferGeometry {
    const cached = PART_GEOMETRY_CACHE.get(shape);
    if (cached) return cached;

    let geometry: THREE.BufferGeometry;
    switch (shape) {
        case 'beam':
            geometry = new THREE.BoxGeometry(BUILDING_DETAIL_PART_SIZE, BUILDING_DETAIL_PART_SIZE, BUILDING_DETAIL_PART_SIZE);
            break;
        case 'wedge':
            geometry = new THREE.ConeGeometry(BUILDING_DETAIL_PART_SIZE * 0.78, BUILDING_DETAIL_PART_SIZE, 4);
            geometry.rotateY(Math.PI / 4);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(BUILDING_DETAIL_PART_SIZE * 0.48, BUILDING_DETAIL_PART_SIZE * 0.48, BUILDING_DETAIL_PART_SIZE, 16);
            break;
        case 'spire':
            geometry = new THREE.ConeGeometry(BUILDING_DETAIL_PART_SIZE * 0.5, BUILDING_DETAIL_PART_SIZE * 1.3, 16);
            break;
        case 'block':
        default:
            geometry = new THREE.BoxGeometry(BUILDING_DETAIL_PART_SIZE, BUILDING_DETAIL_PART_SIZE, BUILDING_DETAIL_PART_SIZE);
            break;
    }

    PART_GEOMETRY_CACHE.set(shape, geometry);
    return geometry;
}

function createPartMatrix(part: BuildingVoxelPart): THREE.Matrix4 {
    const position = new THREE.Vector3(part.x, part.y, part.z);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(part.rotationY ?? 0), 0));
    const scale = new THREE.Vector3(part.scaleX ?? 1, part.scaleY ?? 1, part.scaleZ ?? 1);
    return new THREE.Matrix4().compose(position, rotation, scale);
}

function createSelectionProxy(part: BuildingVoxelPart): THREE.Mesh {
    const proxy = new THREE.Mesh(createPartGeometry(part.shape || 'block'), new THREE.MeshBasicMaterial());
    proxy.position.set(part.x, part.y, part.z);
    proxy.scale.set(part.scaleX ?? 1, part.scaleY ?? 1, part.scaleZ ?? 1);
    proxy.rotation.y = THREE.MathUtils.degToRad(part.rotationY ?? 0);
    proxy.updateMatrixWorld(true);
    return proxy;
}

function disposeSelectionProxy(proxy: THREE.Mesh): void {
    const material = proxy.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material.dispose();
}

function createMirroredPart(part: BuildingVoxelPart): BuildingVoxelPart | null {
    if (Math.abs(part.x) < BUILDING_DETAIL_GRID_STEP * 0.5) return null;
    const mirrored = createPart(-part.x, part.y, part.z, part.role, part.shape || 'block');
    return {
        ...mirrored,
        scaleX: part.scaleX,
        scaleY: part.scaleY,
        scaleZ: part.scaleZ,
        rotationY: part.rotationY === undefined ? 0 : (360 - part.rotationY) % 360,
    };
}

function getShapePreviewGlyph(shape: BuildingVoxelShape): string {
    switch (shape) {
        case 'beam': return '-';
        case 'wedge': return '^';
        case 'cylinder': return 'o';
        case 'spire': return '*';
        case 'block':
        default: return '#';
    }
}

function clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) group.remove(group.children[0]);
}

function disposeGroupMeshes(group: THREE.Group): void {
    group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
    });
}

function disposeEditMeshes(meshes: THREE.Mesh[]): void {
    for (const mesh of meshes) {
        if (!mesh.userData.sharedGeometry && !Array.from(PART_GEOMETRY_CACHE.values()).includes(mesh.geometry)) {
            mesh.geometry.dispose();
        }
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
    }
}

function clampGrid(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function formatCoord(value: number): string {
    return value.toFixed(2).replace(/\.00$/, '');
}
