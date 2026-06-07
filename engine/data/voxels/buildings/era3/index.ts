
import { BuildingType } from '../../../../../types';
import { PondFactory } from './Pond';
import { RecyclingPlantFactory } from './RecyclingPlant';
import { OreFoundryFactory } from './OreFoundry';
import { GemRefineryFactory } from './GemRefinery';

export const Era3Buildings = {
    [BuildingType.POND]: PondFactory,
    [BuildingType.RECYCLING_PLANT]: RecyclingPlantFactory,
    [BuildingType.ORE_FOUNDRY]: OreFoundryFactory,
    [BuildingType.GEM_REFINERY]: GemRefineryFactory
};