declare module 'three-instanced-uniforms-mesh' {
    import type {
        BufferGeometry,
        Color,
        InstancedMesh,
        Material,
        Matrix3,
        Matrix4,
        Quaternion,
        Vector2,
        Vector3,
        Vector4,
    } from 'three';

    export type InstancedUniformValue =
        | number
        | number[]
        | Vector2
        | Vector3
        | Vector4
        | Color
        | Matrix3
        | Matrix4
        | Quaternion;

    export class InstancedUniformsMesh<T extends Material = Material> extends InstancedMesh<BufferGeometry, T> {
        constructor(geometry: BufferGeometry, material: T, count: number);
        setUniformAt(name: string, index: number, value: InstancedUniformValue): void;
        unsetUniform(name: string): void;
    }

    export function createInstancedUniformsDerivedMaterial<T extends Material>(material: T): T;
}
