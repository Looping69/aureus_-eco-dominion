import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const buildingIndexPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'buildings', 'index.ts');
const infrastructurePath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'buildings', 'infrastructure', 'index.ts');
const era1IndexPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'buildings', 'era1', 'index.ts');
const era2IndexPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'buildings', 'era2', 'index.ts');
const era3IndexPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'buildings', 'era3', 'index.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('infrastructure voxel assets are registered through their own asset family', () => {
  assert.equal(existsSync(buildingIndexPath), true, 'building factory index is missing');
  assert.equal(existsSync(infrastructurePath), true, 'infrastructure asset family index is missing');

  const buildingIndex = readFileSync(buildingIndexPath, 'utf8');
  const infrastructure = readFileSync(infrastructurePath, 'utf8');

  for (const snippet of [
    "import { InfrastructureBuildings } from './infrastructure';",
    '...CommonBuildings,',
    '...InfrastructureBuildings,',
    '...Era1Buildings,',
  ]) {
    assert.match(buildingIndex, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    "import { RoadFactory } from '../era1/Road';",
    "import { PipeFactory } from '../era1/Pipe';",
    "import { PowerLineFactory } from '../era1/PowerLine';",
    "import { FenceFactory } from '../era2/Fence';",
    "import { RailLineFactory } from '../era3/RailLine';",
    "import { TrainStationFactory } from '../era3/TrainStation';",
    "import { DistributionHubFactory } from '../era3/DistributionHub';",
    'export const InfrastructureBuildings = {',
    '[BuildingType.ROAD]: RoadFactory,',
    '[BuildingType.PIPE]: PipeFactory,',
    '[BuildingType.POWER_LINE]: PowerLineFactory,',
    '[BuildingType.FENCE]: FenceFactory,',
    '[BuildingType.RAIL_LINE]: RailLineFactory,',
    '[BuildingType.TRAIN_STATION]: TrainStationFactory,',
    '[BuildingType.DISTRIBUTION_HUB]: DistributionHubFactory,',
  ]) {
    assert.match(infrastructure, new RegExp(escapeRegExp(snippet)));
  }
});

test('era asset indexes no longer own infrastructure registrations', () => {
  assert.equal(existsSync(era1IndexPath), true, 'era1 index is missing');
  assert.equal(existsSync(era2IndexPath), true, 'era2 index is missing');
  assert.equal(existsSync(era3IndexPath), true, 'era3 index is missing');

  const era1 = readFileSync(era1IndexPath, 'utf8');
  const era2 = readFileSync(era2IndexPath, 'utf8');
  const era3 = readFileSync(era3IndexPath, 'utf8');

  for (const source of [era1, era2, era3]) {
    assert.doesNotMatch(source, /BuildingType\.ROAD/);
    assert.doesNotMatch(source, /BuildingType\.PIPE/);
    assert.doesNotMatch(source, /BuildingType\.POWER_LINE/);
    assert.doesNotMatch(source, /BuildingType\.FENCE/);
    assert.doesNotMatch(source, /BuildingType\.RAIL_LINE/);
    assert.doesNotMatch(source, /BuildingType\.TRAIN_STATION/);
    assert.doesNotMatch(source, /BuildingType\.DISTRIBUTION_HUB/);
  }
});
