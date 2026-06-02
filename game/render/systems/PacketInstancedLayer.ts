import * as THREE from 'three';

export interface PacketInstanceSpec {
    bucketKey: string;
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    position: THREE.Vector3;
    scale: number;
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
}

interface PacketInstanceBucket {
    mesh: THREE.InstancedMesh;
    capacity: number;
}

export class PacketInstancedLayer {
    private scene: THREE.Scene;
    private root = new THREE.Group();
    private buckets = new Map<string, PacketInstanceBucket>();
    private pool = new Map<string, THREE.InstancedMesh[]>();
    private readonly dummy = new THREE.Object3D();
    private readonly maxPoolSizePerBucket = 4;

    constructor(scene: THREE.Scene, renderOrder: number = 9) {
        this.scene = scene;
        this.root.renderOrder = renderOrder;
        this.scene.add(this.root);
    }

    public sync(instances: PacketInstanceSpec[]): void {
        const grouped = new Map<string, PacketInstanceSpec[]>();
        for (const instance of instances) {
            const bucket = grouped.get(instance.bucketKey);
            if (bucket) {
                bucket.push(instance);
            } else {
                grouped.set(instance.bucketKey, [instance]);
            }
        }

        for (const [bucketKey, specs] of grouped) {
            const first = specs[0];
            const bucket = this.ensureBucket(bucketKey, first.geometry, first.material, specs.length);
            const mesh = bucket.mesh;
            mesh.geometry = first.geometry;
            mesh.material = first.material;
            mesh.count = specs.length;
            mesh.visible = specs.length > 0;
            mesh.renderOrder = this.root.renderOrder;

            for (let i = 0; i < specs.length; i++) {
                const spec = specs[i];
                this.dummy.position.copy(spec.position);
                this.dummy.rotation.set(spec.rotationX || 0, spec.rotationY || 0, spec.rotationZ || 0);
                this.dummy.scale.set(
                    spec.scaleX ?? spec.scale,
                    spec.scaleY ?? spec.scale,
                    spec.scaleZ ?? spec.scale,
                );
                this.dummy.updateMatrix();
                mesh.setMatrixAt(i, this.dummy.matrix);
            }

            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
        }

        for (const [bucketKey, bucket] of this.buckets) {
            if (grouped.has(bucketKey)) continue;
            bucket.mesh.count = 0;
            bucket.mesh.visible = false;
        }
    }

    public dispose(): void {
        for (const bucket of this.buckets.values()) {
            this.root.remove(bucket.mesh);
            bucket.mesh.dispose();
        }
        this.buckets.clear();

        for (const pooledMeshes of this.pool.values()) {
            for (const mesh of pooledMeshes) {
                this.root.remove(mesh);
                mesh.dispose();
            }
        }
        this.pool.clear();

        this.scene.remove(this.root);
    }

    private ensureBucket(bucketKey: string, geometry: THREE.BufferGeometry, material: THREE.Material, count: number): PacketInstanceBucket {
        const existing = this.buckets.get(bucketKey);
        if (existing && existing.capacity >= count) {
            return existing;
        }

        if (existing) {
            this.releaseBucket(bucketKey, existing);
        }

        const mesh = this.acquireMesh(bucketKey, geometry, material, count);
        const next = { mesh, capacity: this.getCapacity(count) };
        this.buckets.set(bucketKey, next);
        return next;
    }

    private acquireMesh(bucketKey: string, geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {
        const pooled = this.pool.get(bucketKey) || [];
        this.pool.set(bucketKey, pooled);

        const neededCapacity = this.getCapacity(count);
        const pooledIndex = pooled.findIndex((mesh) => (mesh.userData.capacity || 0) >= neededCapacity);
        const mesh = pooledIndex >= 0
            ? pooled.splice(pooledIndex, 1)[0]
            : new THREE.InstancedMesh(geometry, material, neededCapacity);

        mesh.geometry = geometry;
        mesh.material = material;
        mesh.userData.capacity = neededCapacity;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = true;
        mesh.visible = true;
        mesh.renderOrder = this.root.renderOrder;
        if (!this.root.children.includes(mesh)) {
            this.root.add(mesh);
        }
        return mesh;
    }

    private releaseBucket(bucketKey: string, bucket: PacketInstanceBucket): void {
        const pooled = this.pool.get(bucketKey) || [];
        this.pool.set(bucketKey, pooled);
        this.root.remove(bucket.mesh);
        bucket.mesh.visible = false;
        bucket.mesh.count = 0;
        if (pooled.length < this.maxPoolSizePerBucket) {
            pooled.push(bucket.mesh);
            return;
        }
        bucket.mesh.dispose();
    }

    private getCapacity(count: number): number {
        let capacity = 1;
        while (capacity < Math.max(1, count)) {
            capacity *= 2;
        }
        return capacity;
    }
}
