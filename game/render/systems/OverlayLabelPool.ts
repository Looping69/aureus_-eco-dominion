import * as THREE from 'three';

export class OverlayLabelPool {
    private spritePool: THREE.Sprite[] = [];
    private activeSprites: THREE.Sprite[] = [];

    constructor(private readonly maxPoolSize: number = 48) {}

    public beginFrame(packetGroup: THREE.Group, overlayGroup: THREE.Group) {
        for (const sprite of this.activeSprites) {
            sprite.removeFromParent();
            if (this.spritePool.length < this.maxPoolSize) {
                this.spritePool.push(sprite);
            }
        }
        this.activeSprites = [];
        this.clearGroup(packetGroup);
        this.clearGroup(overlayGroup);
    }

    public addLabel(
        group: THREE.Group,
        material: THREE.SpriteMaterial,
        scaleX: number,
        scaleY: number,
        x: number,
        y: number,
        z: number,
    ) {
        const sprite = this.spritePool.pop() || new THREE.Sprite();
        sprite.material = material;
        sprite.scale.set(scaleX, scaleY, 1);
        sprite.position.set(x, y, z);
        group.add(sprite);
        this.activeSprites.push(sprite);
        return sprite;
    }

    private clearGroup(group: THREE.Group) {
        while (group.children.length > 0) {
            group.remove(group.children[0]);
        }
    }
}
