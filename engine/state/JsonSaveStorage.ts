/** Keyed string storage for a game-owned save codec. */
export class JsonSaveStorage {
    constructor(private readonly key: string, private readonly getStorage: () => Storage = () => localStorage) {}

    write(serialized: string): void { this.getStorage().setItem(this.key, serialized); }
    read(): string | null { return this.getStorage().getItem(this.key); }
    has(): boolean { return this.read() !== null; }
    remove(): void { this.getStorage().removeItem(this.key); }
}
