import type { GameActionPayloadSchema, GameDefinition } from '../engine/game-definition/types';

const tileCoordinatePayloadSchema: GameActionPayloadSchema = {
  x: {
    type: 'number',
    required: true,
    description: 'Finite surface tile X coordinate.',
  },
  z: {
    type: 'number',
    required: true,
    description: 'Finite surface tile Z coordinate.',
  },
};

const placeBuildingPayloadSchema: GameActionPayloadSchema = {
  x: tileCoordinatePayloadSchema.x,
  z: tileCoordinatePayloadSchema.z,
  buildingType: {
    type: 'string',
    required: true,
    description: 'Building archetype identifier to place.',
  },
};

const buyBuildingPayloadSchema: GameActionPayloadSchema = {
  buildingType: {
    type: 'string',
    required: true,
    description: 'Building archetype identifier to purchase.',
  },
  cost: {
    type: 'number',
    required: true,
    description: 'Finite AGT purchase cost supplied by the active game pack.',
  },
};

const BUILD_ACTION_PAYLOAD_SCHEMAS: Readonly<Record<string, GameActionPayloadSchema>> = {
  PLACE_BUILDING: placeBuildingPayloadSchema,
  BUY_BUILDING: buyBuildingPayloadSchema,
  BULLDOZE: tileCoordinatePayloadSchema,
  SPEED_UP: tileCoordinatePayloadSchema,
  REHABILITATE: tileCoordinatePayloadSchema,
  UPGRADE_BUILDING: tileCoordinatePayloadSchema,
};

export function withAureusBuildActionPayloadSchemas(definition: GameDefinition): GameDefinition {
  return {
    ...definition,
    actions: definition.actions.map((action) => {
      const payloadSchema = BUILD_ACTION_PAYLOAD_SCHEMAS[action.commandType];
      return payloadSchema ? { ...action, payloadSchema } : action;
    }),
  };
}

export { BUILD_ACTION_PAYLOAD_SCHEMAS };
