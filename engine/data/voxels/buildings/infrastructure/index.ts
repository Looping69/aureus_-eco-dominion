import { BuildingType } from '../../../../../types';
import { RoadFactory } from '../era1/Road';
import { PipeFactory } from '../era1/Pipe';
import { PowerLineFactory } from '../era1/PowerLine';
import { FenceFactory } from '../era2/Fence';
import { RailLineFactory } from '../era3/RailLine';
import { TrainStationFactory } from '../era3/TrainStation';
import { DistributionHubFactory } from '../era3/DistributionHub';

export const InfrastructureBuildings = {
    [BuildingType.ROAD]: RoadFactory,
    [BuildingType.PIPE]: PipeFactory,
    [BuildingType.POWER_LINE]: PowerLineFactory,
    [BuildingType.FENCE]: FenceFactory,
    [BuildingType.RAIL_LINE]: RailLineFactory,
    [BuildingType.TRAIN_STATION]: TrainStationFactory,
    [BuildingType.DISTRIBUTION_HUB]: DistributionHubFactory,
};
