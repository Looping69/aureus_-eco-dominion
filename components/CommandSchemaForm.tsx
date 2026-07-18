import React, { useMemo, useState } from 'react';
import { Play, SlidersHorizontal } from 'lucide-react';
import type { Action } from '../types';
import type { GameActionDefinition, GameActionPayloadFieldDefinition } from '../engine/game-definition';
import { getActiveGameDefinition } from '../game-definitions/activeGameDefinition';

interface CommandSchemaFormProps {
  dispatch: React.Dispatch<Action>;
}

type FormValues = Record<string, string>;

function getSchemaActions(): GameActionDefinition[] {
  return getActiveGameDefinition().actions.filter((action) => action.payloadSchema && action.payloadFields.length > 0);
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

function getInitialValues(action: GameActionDefinition | null): FormValues {
  if (!action?.payloadSchema) return {};

  return action.payloadFields.reduce<FormValues>((values, field) => {
    const schema = action.payloadSchema?.[field];
    values[field] = schema ? getDefaultFieldValue(schema) : '';
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
  const actions = useMemo(() => getSchemaActions(), []);
  const [selectedActionId, setSelectedActionId] = useState(actions[0]?.id ?? '');
  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId) ?? actions[0] ?? null,
    [actions, selectedActionId]
  );
  const [values, setValues] = useState<FormValues>(() => getInitialValues(selectedAction));
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const selectAction = (actionId: string) => {
    const action = actions.find((candidate) => candidate.id === actionId) ?? null;
    setSelectedActionId(actionId);
    setValues(getInitialValues(action));
    setLastCommand(null);
  };

  const submitCommand = () => {
    if (!selectedAction) return;
    const payload = buildPayload(selectedAction, values);
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

      <div className="mt-2 space-y-1.5">
        {selectedAction.payloadFields.map((field) => {
          const schema = selectedAction.payloadSchema?.[field];
          if (!schema) return null;

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

      <button
        type="button"
        onClick={submitCommand}
        className="w-full mt-2 py-1.5 px-2 rounded-[2px] font-bold text-[9px] flex items-center justify-center gap-2 transition-all border border-cyan-600/50 bg-cyan-950/25 text-cyan-300 hover:bg-cyan-900/35 uppercase tracking-widest font-['Rajdhani']"
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
