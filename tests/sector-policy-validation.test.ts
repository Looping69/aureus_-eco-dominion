import assert from 'node:assert/strict';
import test from 'node:test';
import { applySectorPolicyCommand } from '../engine/sim/logic/sectorPolicyCommand.ts';
import type { FactorySectorState } from '../engine/types/game';

function sector(name = 'North'): FactorySectorState {
    return {
        name, exportFocus: 'MINERALS', importFocus: 'WOOD', exportBonus: 0,
        importDiscount: 0, demandBonus: 0, stationCount: 1, throughput: 10,
    };
}

test('sector policy patches preserve defaults, existing values and unrelated sectors', () => {
    const other = sector('South');
    const sectors = [{ ...sector(), contractProgress: 9, contractReward: 120 }, other];
    assert.equal(applySectorPolicyCommand(sectors, { sectorName: 'North', directive: 'EXPORT' }).ok, true);
    assert.deepEqual(sectors[0], {
        ...sector(), contractProgress: 9, contractReward: 120, directive: 'EXPORT',
        priorityResource: 'MINERALS', flowMode: 'STABLE', congestionPolicy: 'BALANCED',
        contractResource: 'WOOD', contractTarget: 24,
    });
    assert.equal(applySectorPolicyCommand(sectors, { sectorName: 'North', flowMode: 'SURGE', contractTarget: 48 }).ok, true);
    assert.equal(sectors[0].directive, 'EXPORT');
    assert.equal(sectors[0].flowMode, 'SURGE');
    assert.equal(sectors[0].contractTarget, 48);
    assert.equal(sectors[1], other);
});

test('valid patches cover every editable sector policy', () => {
    const sectors = [sector()];
    const payload = {
        sectorName: 'North', directive: 'IMPORT', priorityResource: 'ORE', flowMode: 'SURGE',
        congestionPolicy: 'SAFE', contractResource: 'AUTOMATION_KITS', contractTarget: 96,
    };
    assert.equal(applySectorPolicyCommand(sectors, payload).ok, true);
    const { sectorName, ...updates } = payload;
    assert.deepEqual(sectors[0], { ...sector(), ...updates });
});

const badPayloads: Array<[string, unknown]> = [
    ['missing payload', undefined], ['null payload', null], ['array', []],
    ['primitive', 'North'], ['missing name', {}], ['blank name', { sectorName: ' ' }],
    ['missing sector', { sectorName: 'Missing', directive: 'EXPORT' }],
    ['invalid directive', { sectorName: 'North', directive: 'INVALID' }],
    ['invalid resource', { sectorName: 'North', priorityResource: 'BITCOIN' }],
    ['invalid flow', { sectorName: 'North', flowMode: 'TURBO' }],
    ['invalid congestion', { sectorName: 'North', congestionPolicy: false }],
    ['invalid quota resource', { sectorName: 'North', contractResource: 'AGT' }],
    ['negative quota', { sectorName: 'North', contractTarget: -1 }],
    ['zero quota', { sectorName: 'North', contractTarget: 0 }],
    ['infinite quota', { sectorName: 'North', contractTarget: Infinity }],
    ['NaN quota', { sectorName: 'North', contractTarget: NaN }],
    ['string quota', { sectorName: 'North', contractTarget: '48' }],
    ['partial valid patch', { sectorName: 'North', directive: 'EXPORT', contractTarget: -1 }],
    ['read-only field injection', { sectorName: 'North', directive: 'EXPORT', contractReward: 999999 }],
];

for (const [name, payload] of badPayloads) {
    test(`invalid sector policy is atomic: ${name}`, () => {
        const original = sector();
        const sectors = [original];
        const before = structuredClone(sectors);
        assert.equal(applySectorPolicyCommand(sectors, payload).ok, false);
        assert.deepEqual(sectors, before);
        assert.equal(sectors[0], original);
    });
}

test('missing factory sectors are rejected without initialization side effects', () => {
    assert.equal(applySectorPolicyCommand(undefined, { sectorName: 'North' }).ok, false);
});

test('optional nullish fields retain established policy values', () => {
    const sectors = [{ ...sector(), directive: 'IMPORT' as const, contractTarget: 48 }];
    assert.equal(applySectorPolicyCommand(sectors, { sectorName: 'North', directive: null, contractTarget: undefined }).ok, true);
    assert.equal(sectors[0].directive, 'IMPORT');
    assert.equal(sectors[0].contractTarget, 48);
});

test('identical ordered policy patches produce identical sector state', () => {
    const run = () => {
        const sectors = [sector()];
        for (const patch of [{ directive: 'EXPORT' }, { contractResource: 'GEMS' }, { contractTarget: 96 }]) {
            assert.equal(applySectorPolicyCommand(sectors, { sectorName: 'North', ...patch }).ok, true);
        }
        return sectors;
    };
    assert.deepEqual(run(), run());
});
