import type { World } from '../world/World';

type RuntimeEntry = { services: unknown; world: World };

/** Executable factories; the engine does not know pack IDs or game services. */
export class RuntimeRegistry<Entries extends { [K in keyof Entries]: RuntimeEntry }> {
    private factories = new Map<string, (services: unknown) => Promise<World>>();

    register<K extends keyof Entries & string>(id: K, factory: (services: Entries[K]['services']) => Promise<Entries[K]['world']>): this {
        if (this.factories.has(id)) throw new Error(`Runtime already registered: '${id}'`);
        this.factories.set(id, factory as (services: unknown) => Promise<World>);
        return this;
    }

    has(id: string): id is keyof Entries & string { return this.factories.has(id); }

    async create<K extends keyof Entries & string>(id: K, services: Entries[K]['services']): Promise<Entries[K]['world']> {
        const factory = this.factories.get(id);
        if (!factory) throw new Error(`Unknown game pack runtime '${id}'`);
        return await factory(services) as Entries[K]['world'];
    }
}
