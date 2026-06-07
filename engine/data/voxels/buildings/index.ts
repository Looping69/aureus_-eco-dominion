import { CommonBuildings } from './common';
import { InfrastructureBuildings } from './infrastructure';
import { Era1Buildings } from './era1';
import { Era2Buildings } from './era2';
import { Era3Buildings } from './era3';
import { Era4Buildings } from './era4';
import { Era5Buildings } from './era5';

export const BuildingsFactory = {
    ...CommonBuildings,
    ...InfrastructureBuildings,
    ...Era1Buildings,
    ...Era2Buildings,
    ...Era3Buildings,
    ...Era4Buildings,
    ...Era5Buildings
};
