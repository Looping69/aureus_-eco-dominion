import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Eraser, MousePointer2, Plus, RotateCcw, Save } from 'lucide-react';
import { BuildingType } from '../types';
import { BuildingsFactory } from '../engine/data/voxels/buildings';
import { BuildingStyleSettings } from '../game/design/buildingStyle';
import { applyBuildingStyleToGroup } from '../game/design/buildingStyleRuntime';
import {
    BuildingBlueprint,
    BuildingVoxelPart,
    BuildingVoxelRole,
    createDefaultBuildingBlueprint,
    createPart,
    dedupeParts,
    DESIGNABLE_BUILDINGS,
    getBuildingDisplayName,
    getVoxelRoleColor,
    loadBuildingBlueprint,
    saveBuildingBlueprint,
} from '../game/design/buildingBlueprint';

type StudioTool = 'add' | 'remove' | 'paint';

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
    hitMeshes: THREE.Object3D[];
    selectedOutline: THREE.BoxHelper;
    orbit: { theta: number; phi: number; radius: number; dragging: boolean; moved: boolean; x: number; y: number };
};

type StudioHit = {
    part?: BuildingVoxelPart;
    normal: THREE.Vector3;
    point: THREE.Vector3;
};

const ROLE_LABELS: Record<BuildingVoxelRole, string> = {
    wall: 'Wall',
    roof: 'Roof',
    accent: 'Accent',
    greenery: 'Greenery',
};

const TOOL_LABELS: Record<StudioTool, string> = {
    add: 'Add',
    remove: 'Remove',
    paint: 'Paint',
};

interface BuildingVoxelStudioProps {
    settings: BuildingStyleSettings;
}

export const BuildingVoxelStudio: React.FC<BuildingVoxelStudioProps> = ({ settings }) => {
    const [buildingType, setBuildingType] = useState<BuildingType>(BuildingType.STAFF_QUARTERS);
    const [blueprint, setBlueprint] = useState<BuildingBlueprint>(() => loadBuildingBlueprint(BuildingType.STAFF_QUARTERS));
    const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
    const [selectedNormal, setSelectedNormal] = useState<THREE.Vector3Tuple>([0, 1, 0]);
    const [lastHit, setLastHit] = useState<StudioHit | null>(null);
    const [tool, setTool] = useState<StudioTool>('add');
    const [role, setRole] = useState<BuildingVoxelRole>('wall');
    const [saved, setSaved] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneStateRef = useRef<StudioSceneState | null>(null);

    const selectedPart = useMemo(
        () => blueprint.parts.find((part) => part.id === selectedPartId) || null,
        [blueprint.parts, selectedPartId],
    );

    useEffect(() => {
        const next = loadBuildingBlueprint(buildingType);
        setBlueprint(next);
        setSelectedPartId(next.parts[0]?.id || null);
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

        const hemi = new THREE.HemisphereLight('#dff7ff', '#162030', 1.45);
        scene.add(hemi);
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

        const grid = new THREE.GridHelper(18, 18, '#315063', '#183043');
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
            state.orbit.radius = Math.max(4.5, Math.min(18, state.orbit.radius + Math.sign(event.deltaY) * 0.8));
            positionCamera();
        };

        const render = () => renderer.render(scene, camera);
        resize();
        positionCamera();
        renderer.setAnimationLoop(render);

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
            clearGroup(state.baseGroup);
            renderer.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
            sceneStateRef.current = null;
        };
    }, []);

    useEffect(() => {
        rebuildPreview(buildingType, blueprint.parts, settings, selectedPartId);
    }, [buildingType, blueprint.parts, settings, selectedPartId]);

    const rebuildPreview = (
        type: BuildingType,
        parts: BuildingVoxelPart[],
        nextSettings: BuildingStyleSettings,
        activePartId: string | null,
    ): void => {
        const state = sceneStateRef.current;
        if (!state) return;

        clearGroup(state.baseGroup);
        disposeEditMeshes(state.editMeshes);
        for (const mesh of state.editMeshes) state.editGroup.remove(mesh);
        state.editMeshes = [];
        state.hitMeshes = [];

        const actual = createActualGameBuilding(type, nextSettings);
        state.baseGroup.add(actual);
        actual.traverse((object) => {
            if (!(object as THREE.Mesh).isMesh) return;
            const mesh = object as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.baseBuildingMesh = true;
            state.hitMeshes.push(mesh);
        });

        let selectedMesh: THREE.Mesh | null = null;
        for (const part of parts) {
            const color = getVoxelRoleColor(part.role, nextSettings);
            const material = new THREE.MeshStandardMaterial({
                color,
                roughness: part.role === 'accent' ? 0.36 : 0.72,
                metalness: part.role === 'accent' ? 0.18 : 0.04,
                emissive: part.role === 'accent' ? new THREE.Color(color) : new THREE.Color('#000000'),
                emissiveIntensity: part.role === 'accent' ? nextSettings.nightGlow * 0.32 : 0,
            });
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), material);
            mesh.position.set(part.x, part.y, part.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.partId = part.id;
            state.editGroup.add(mesh);
            state.editMeshes.push(mesh);
            state.hitMeshes.push(mesh);
            if (part.id === activePartId) selectedMesh = mesh;
        }

        if (selectedMesh) {
            state.selectedOutline.setFromObject(selectedMesh);
            state.selectedOutline.visible = true;
        } else {
            state.selectedOutline.visible = false;
        }
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
        const id = hit.object.userData.partId as string | undefined;
        const hitPart = id ? blueprint.parts.find((part) => part.id === id) : undefined;
        const studioHit = { part: hitPart, normal, point: hit.point.clone() };
        setLastHit(studioHit);
        setSelectedNormal([normal.x, normal.y, normal.z]);

        if (hitPart) {
            setSelectedPartId(hitPart.id);
            if (tool === 'remove') removePart(hitPart.id);
            else if (tool === 'paint') paintPart(hitPart.id, role);
            else addAdjacentPart(hitPart, normal, role);
        } else {
            setSelectedPartId(null);
            if (tool === 'add') addPartAtHit(studioHit, role);
        }
    };

    const addAdjacentPart = (part: BuildingVoxelPart, normal: THREE.Vector3, nextRole = role) => {
        const nextPart = createPart(
            clampGrid(part.x + Math.round(normal.x), -8, 8),
            clampGrid(part.y + Math.round(normal.y), 0, 12),
            clampGrid(part.z + Math.round(normal.z), -8, 8),
            nextRole,
        );
        addPart(nextPart);
    };

    const addPartAtHit = (hit: StudioHit, nextRole = role) => {
        const target = hit.point.clone().add(hit.normal.clone().multiplyScalar(0.5));
        const nextPart = createPart(
            clampGrid(Math.round(target.x), -8, 8),
            clampGrid(Math.round(target.y), 0, 12),
            clampGrid(Math.round(target.z), -8, 8),
            nextRole,
        );
        addPart(nextPart);
    };

    const addPart = (part: BuildingVoxelPart) => {
        setBlueprint((current) => ({ ...current, parts: dedupeParts([...current.parts, part]), updatedAt: Date.now() }));
        setSelectedPartId(part.id);
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

    const addFromSelected = () => {
        if (selectedPart) {
            addAdjacentPart(selectedPart, new THREE.Vector3(...selectedNormal), role);
        } else if (lastHit) {
            addPartAtHit(lastHit, role);
        }
    };

    const handleSave = () => {
        saveBuildingBlueprint(blueprint);
        setSaved(true);
    };

    const handleReset = () => {
        const next = createDefaultBuildingBlueprint(buildingType);
        setBlueprint(next);
        setSelectedPartId(next.parts[0]?.id || null);
        setLastHit(null);
        setSaved(false);
    };

    return (
        <section className="rounded-[6px] border border-cyan-900/50 bg-slate-950 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900 p-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-[0.22em] text-cyan-300">
                        <Box size={14} /> 3D Building Studio
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
                    <button type="button" onClick={handleReset} className="h-10 px-3 rounded-[4px] border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-black uppercase tracking-wider flex items-center gap-2">
                        <RotateCcw size={15} /> Reset Edits
                    </button>
                    <button type="button" onClick={handleSave} className="h-10 px-3 rounded-[4px] border border-emerald-900 bg-emerald-600 hover:bg-emerald-500 text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Save size={15} /> {saved ? 'Saved' : 'Save Edits'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_16rem]">
                <div className="relative h-[30rem] min-h-[24rem] border-b border-slate-800 xl:border-b-0 xl:border-r" onClick={handleCanvasClick}>
                    <div ref={containerRef} className="absolute inset-0" />
                    <div className="pointer-events-none absolute left-4 top-4 rounded-[4px] border border-slate-700 bg-slate-950/80 px-3 py-2 text-[11px] font-bold text-slate-300 backdrop-blur">
                        Live game model. Drag to orbit. Wheel to zoom. Click the model to add detail.
                    </div>
                    {selectedPart && (
                        <div className="pointer-events-none absolute bottom-4 left-4 rounded-[4px] border border-cyan-800 bg-slate-950/85 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-cyan-200 backdrop-blur">
                            Selected edit {selectedPart.x}, {selectedPart.y}, {selectedPart.z} · {ROLE_LABELS[selectedPart.role]}
                        </div>
                    )}
                </div>

                <div className="space-y-4 bg-slate-900 p-4">
                    <div>
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Tool</div>
                        <div className="grid grid-cols-3 gap-2">
                            {(['add', 'remove', 'paint'] as StudioTool[]).map((item) => (
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
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Edit Part</div>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(ROLE_LABELS) as BuildingVoxelRole[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => {
                                        setRole(item);
                                        if (tool === 'paint') paintPart(selectedPartId, item);
                                    }}
                                    className={`h-12 rounded-[4px] border px-2 text-left text-[10px] font-black uppercase tracking-wider ${role === item ? 'border-cyan-400 bg-cyan-950 text-cyan-100' : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <span className="mb-1 block h-2 rounded-[2px]" style={{ backgroundColor: getVoxelRoleColor(item, settings) }} />
                                    {ROLE_LABELS[item]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={addFromSelected} className="h-11 rounded-[4px] border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
                            <Plus size={15} /> Add
                        </button>
                        <button type="button" onClick={() => removePart()} className="h-11 rounded-[4px] border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
                            <Eraser size={15} /> Remove
                        </button>
                    </div>

                    <div className="rounded-[4px] border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                        <div className="flex items-center gap-2 font-black uppercase tracking-wider text-slate-300"><MousePointer2 size={14} /> Shape Data</div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <span>Base</span><strong className="text-right text-white">Game Factory</strong>
                            <span>Edits</span><strong className="text-right text-white">{blueprint.parts.length}</strong>
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

function clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
        group.remove(group.children[0]);
    }
}

function disposeEditMeshes(meshes: THREE.Mesh[]): void {
    for (const mesh of meshes) {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
    }
}

function clampGrid(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
