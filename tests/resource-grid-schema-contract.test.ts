import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('resource grid roles are built from a raw schema-friendly data table', () => {
    const schema = source('engine/data/resourceGridRoleSchema.ts');
    const roles = source('engine/data/resourceGridRoles.ts');

    assert.match(schema, /export const RESOURCE_GRID_ROLE_SCHEMA/);
    assert.match(schema, /buildingType: 'PIPE'/);
    assert.match(schema, /buildingType: 'WATER_WELL'/);
    assert.match(schema, /buildingType: 'GENERATOR'/);
    assert.match(schema, /baseProduction: 10/);
    assert.match(schema, /baseDemand: 100/);
    assert.equal(schema.includes('BuildingType'), false);

    assert.match(roles, /import \{ RESOURCE_GRID_ROLE_SCHEMA \} from '\.\/resourceGridRoleSchema'/);
    assert.match(roles, /buildResourceGridBuildingRoles\(RESOURCE_GRID_ROLE_SCHEMA\)/);
    assert.match(roles, /export function buildResourceGridBuildingRoles/);
    assert.match(roles, /BuildingType\[entry\.buildingType as keyof typeof BuildingType\]/);
    assert.match(roles, /Unknown resource grid building type/);
    assert.equal(roles.includes('BuildingType.PIPE'), false);
    assert.equal(roles.includes('BuildingType.WATER_WELL'), false);
    assert.equal(roles.includes('BuildingType.GENERATOR'), false);
});
