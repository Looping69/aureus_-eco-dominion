import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Play, SlidersHorizontal } from 'lucide-react';
import type { Action } from '../types';
import type {
  GameActionDefinition,
  GameActionPayloadFieldDefinition,
  GameActionPayloadOptionSource,
  GameDefinition,
} from '../engine/game-definition';
import { validateGameCommandType } from '../engine/game-definition';
import {
  buildGameCommandValidationContext,
  getActiveLayerNumber,
  getBrowserRuntimeStateSnapshot,
  getRuntimeAgentOptions,
  getRuntimeSelectedAgentIds,
  getSelectedTileDefault,
  type GameCommandRuntimeStateSnapshot,
} from '../engine/game-definition/GameCommandRuntimeContext';
import { getActiveGameDefinition } from '../game-definitions/activeGameDefinition';

interface CommandSchemaFormProps {
  dispatch: React.Dispatch<Action>;
}

type FormValues = Record<string, string>;

function getSchemaActions(definition: GameDefinition): GameActionDefinition[] {
  return definition.actions.filter((action) => action.payloadSchema && action.payloadFields.length > 0);
}

function getDefaultFromOptionSource(
  source: GameActionPayloadOptionSource | undefined,
  field: string,
  definition: GameDefinition,
  state: GameCommandRuntimeStateSnapshot,
): string | null {
  switch (source) {
    case 'runtime.agents':
      return getRuntimeAgentOptions(state)[0]?.value ?? (typeof state?.selectedAgentId === 'string' ? state.selectedAgentId : null);
    case 'runtime.selectedAgents': {
      const selectedAgentIds = getRuntimeSelectedAgentIds(state);
      if (selectedAgentIds.length > 0) return selectedAgentIds.join(', ');
      return null;
    }
    case 'runtime.selectedTile':
      return getSelectedTileDefault(state, field);
    case 'runtime.activeLayer':
      return getActiveLayerNumber(state)?.toString() ?? null;
    case 'resources.tradeable':
      return definition.resources.find((resource) => resource.tradeable)?.id ?? null;
    case 'entities.buildings':
      return getBuildingTypeOptions(definition)[0]?.value ?? null;
    case 'techs':
      return null;
    default:
      return null;
  }
}

function getSmartFieldDefault(
  field: string,
  schema: GameActionPayloadFieldDefinition,
  definition: GameDefinition,
  state: GameCommandRuntimeStateSnapshot,
): string {
  return getDefaultFromOptionSource(schema.optionSource, field, definition, state) ?? getDefaultFieldValue(schema);
}

function getDefaultFieldValue(schema: GameActionPayloadFieldDefinition): string {
  switch (schema.type) {
    case 'number':
      return '0';
    case 'boolean':
      return 'false';
    case 'string[]':
    case 'number[]':
      return '';
    case 'object':
    case 'any':
      return '{}';
    case 'string':
    default:
      return '';
  }
}

function getInitialValues(action: GameActionDefinition | null, definition: GameDefinition): FormValues {
  if (!action?.payloadSchema) return {};
  const state = getBrowserRuntimeStateSnapshot();

  return action.payloadFields.reduce<FormValues>((values, field) => {
    const schema = action.payloadSchema?.[field];
    values[field] = schema ? getSmartFieldDefault(field, schema, definition, state) : '';
    return values;
  }, {});
}

function parseFieldValue(schema: GameActionPayloadFieldDefinition, rawValue: string): unknown {
  switch (schema.type) {
    case 'number':
      return Number(rawValue);
    case 'boolean':
      return rawValue === 'true';
    case 'string[]':
      return rawValue.split(',').map((entry) => entry.trim()).filter(Boolean);
    case 'number[]':
      return rawValue.split(',').map((entry) => Number(entry.trim())).filter((entry) => Number.isFinite(entry));
    case 'object':
    case 'any':
      try {
        return JSON.parse(rawValue);
      } catch {
        return rawValue;
      }
    case 'string':
    default:
      return rawValue.trim();
  }
}

function buildPayload(action: GameActionDefinition, values: FormValues): Record<string, unknown> {
  return action.payloadFields.reduce<Record<string, unknown>>((payload, field) => {
    const schema = action.payloadSchema?.[field];
    if (!schema) return payload;
    payload[field] = parseFieldValue(schema, values[field] ?? '');
    return payload;
  }, {});
}

function getBuildingTypeOptions(definition: GameDefinition): Array<{ value: string; label: string }> {
  return definition.entityArchetypes
    .filter((entity) => entity.category === 'building' && typeof (entity.components as any).buildingType === 'string')
    .map((entity) => ({ value: String((entity.components as any).buildingType), label: entity.label }));
}

function getChoiceOptions(
  schema: GameActionPayloadFieldDefinition,
  definition: GameDefinition,
  state: GameCommandRuntimeStateSnapshot,
): Array<{ value: string; label: string }> {
  if (schema.options?.length) return schema.options.map((option) => ({ value: option, label: option }));

  switch (schema.optionSource) {
    case 'entities.buildings':
      return getBuildingTypeOptions(definition);
    case 'resources.tradeable':
      return definition.resources
        .filter((resource) => resource.tradeable)
        .map((resource) => ({ value: resource.id, label: resource.label }));
    case 'runtime.agents':
      return getRuntimeAgentOptions(state);
    default:
      return [];
  }
}

function getInputType(schema: GameActionPayloadFieldDefinition): string {
  return schema.type === 'number' ? 'number' : 'text';
}

function getPlaceholder(schema: GameActionPayloadFieldDefinition): string {
  if (schema.type === 'string[]') return 'agent-1, agent-2';
  if (schema.type === 'number[]') return '1, 2, 3';
  if (schema.type === 'object' || schema.type === 'any') return '{}';
  return schema.type;
}

export const CommandSchemaForm: React.FC<CommandSchemaFormProps> = ({ dispatch }) => {
  const gameDefinition = useMemo(() => getActiveGameDefinition(), []);
  const actions = useMemo(() => getSchemaActions(gameDefinition), [gameDefinition]);
  const [selectedActionId, setSelectedActionId] = useState(actions[0]?.id ?? '');
  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId) ?? actions[0] ?? null,
    [actions, selectedActionId]
  );
  const [values, setValues] = useState<FormValues>(() => getInitialValues(selectedAction, gameDefinition));
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const runtimeState = getBrowserRuntimeStateSnapshot();
  const runtimeValidationContext = buildGameCommandValidationContext(runtimeState);

  const payload = useMemo(() => selectedAction ? buildPayload(selectedAction, values) : {}, [selectedAction, values]);
  const validation = useMemo(
    () => selectedAction ? validateGameCommandType(gameDefinition, selectedAction.commandType, payload, runtimeValidationContext) : { ok: false, reason: 'No schema-backed command selected.' },
    [gameDefinition, payload, runtimeValidationContext, selectedAction]
  );

  const selectAction = (actionId: string) => {
    const action = actions.find((candidate) => candidate.id === actionId) ?? null;
    setSelectedActionId(actionId);
    setValues(getInitialValues(action, gameDefinition));
    setLastCommand(null);
  };

  const applySmartDefaults = () => {
    setValues(getInitialValues(selectedAction, gameDefinition));
    setLastCommand(null);
  };

  const submitCommand = () => {
    if (!selectedAction || !validation.ok) return;
    dispatch({ type: selectedAction.commandType, payload });
    setLastCommand(`${selectedAction.commandType} queued`);
  };

  if (!selectedAction) return null;

  return (
    <div className="mt-3 border border-slate-800 rounded-[3px] bg-slate-950/45 p-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <SlidersHorizontal size={11} className="text-cyan-400 shrink-0" />
          <h4 className="text-[9px] text-slate-300 font-black uppercase tracking-widest font-['Rajdhani'] truncate">Schema Command</h4>
        </div>
        <span className="text-[7px] text-cyan-300 font-mono uppercase">{selectedAction.category}</span>
      </div>

      <select
        value={selectedAction.id}
        onChange={(event) => selectAction(event.target.value)}
        className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono rounded-[2px] px-2 py-1.5 outline-none focus:border-cyan-500"
        title="Choose a command declared by the active game pack payload schema"
      >
        {actions.map((action) => (
          <option key={action.id} value={action.id}>{action.label}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={applySmartDefaults}
        className="w-full mt-2 py-1 px-2 rounded-[2px] font-bold text-[8px] border border-slate-700 bg-slate-900 text-slate-400 hover:text-cyan-300 hover:border-cyan-700 uppercase tracking-widest font-['Rajdhani']"
        title="Refill fields from the currently selected agent, selected tile, active layer, and game pack choices when available"
      >
        Use Current Selection
      </button>

      <div className="mt-2 space-y-1.5">
        {selectedAction.payloadFields.map((field) => {
          const schema = selectedAction.payloadSchema?.[field];
          if (!schema) return null;
          const choices = getChoiceOptions(schema, gameDefinition, runtimeState);

          return (
            <label key={field} className="block">
              <span className="flex items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                <span>{field}</span>
                <span>{schema.type}</span>
              </span>
              {schema.type === 'boolean' ? (
                <select
                  value={values[field] ?? 'false'}
                  onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono rounded-[2px] px-2 py-1 outline-none focus:border-cyan-500"
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              ) : choices.length > 0 ? (
                <select
                  value={values[field] ?? choices[0]?.value ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono rounded-[2px] px-2 py-1 outline-none focus:border-cyan-500"
                >
                  {choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>{choice.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={values[field] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                  type={getInputType(schema)}
                  placeholder={getPlaceholder(schema)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono rounded-[2px] px-2 py-1 outline-none focus:border-cyan-500 placeholder:text-slate-600"
                />
              )}
              {schema.description && (
                <span className="block mt-0.5 text-[7px] text-slate-600 leading-tight">{schema.description}</span>
              )}
            </label>
          );
        })}
      </div>

      <div className={`mt-2 flex items-start gap-1.5 rounded-[2px] border px-2 py-1.5 ${validation.ok ? 'border-emerald-800/60 bg-emerald-950/20 text-emerald-300' : 'border-amber-800/60 bg-amber-950/20 text-amber-300'}`}>
        {validation.ok ? <CheckCircle2 size={11} className="mt-0.5 shrink-0" /> : <AlertTriangle size={11} className="mt-0.5 shrink-0" />}
        <span className="text-[8px] font-mono leading-tight">{validation.ok ? 'Payload ready for dispatch.' : validation.reason}</span>
      </div>

      <button
        type="button"
        onClick={submitCommand}
        disabled={!validation.ok}
        className={`w-full mt-2 py-1.5 px-2 rounded-[2px] font-bold text-[9px] flex items-center justify-center gap-2 transition-all border uppercase tracking-widest font-['Rajdhani'] ${validation.ok ? 'border-cyan-600/50 bg-cyan-950/25 text-cyan-300 hover:bg-cyan-900/35' : 'border-slate-800 bg-slate-900/60 text-slate-600 cursor-not-allowed'}`}
        title="Dispatch this command through the active game command boundary"
      >
        <Play size={11} /> Dispatch {selectedAction.commandType}
      </button>

      {lastCommand && (
        <div className="mt-1.5 text-[8px] text-emerald-400 font-mono truncate" title={lastCommand}>{lastCommand}</div>
      )}
    </div>
  );
};

export default CommandSchemaForm;
