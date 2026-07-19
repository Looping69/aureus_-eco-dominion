import React from 'react';
import { Activity, Box, Database, Eye, EyeOff, FileCode, Hash, Layers, ToggleLeft, ToggleRight, Unlock } from 'lucide-react';
import { Action, GameState } from '../types';
import { GameDefinitionSummary } from '../engine/game-definition';
import { CommandSchemaForm } from './CommandSchemaForm';

interface EngineDevToolsPanelProps {
  activeGameDefinitionSummary: GameDefinitionSummary | null;
  dispatch: React.Dispatch<Action>;
  fogRemoved: boolean;
  state: GameState;
}

const ToolRow = ({ label, value, icon: Icon, color = 'text-emerald-400' }: any) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0 group hover:bg-slate-800/50 px-1 transition-colors">
    <div className="flex items-center gap-2 min-w-0">
      <Icon size={12} className="text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-mono truncate">{label}</span>
    </div>
    <span className={`text-[10px] font-mono font-bold ${color} max-w-[8.5rem] truncate text-right`} title={String(value)}>{value}</span>
  </div>
);

export const EngineDevToolsPanel: React.FC<EngineDevToolsPanelProps> = ({
  activeGameDefinitionSummary,
  dispatch,
  fogRemoved,
  state,
}) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-[9px] text-slate-500 font-black uppercase mb-1.5 flex items-center gap-1.5 font-['Rajdhani'] tracking-widest border-b border-slate-800 pb-0.5">
        <FileCode size={10} /> Engine Game Pack
      </h3>
      {activeGameDefinitionSummary ? (
        <div className="space-y-0.5">
          <ToolRow label="Pack" value={activeGameDefinitionSummary.title} icon={FileCode} color="text-cyan-400" />
          <ToolRow label="Version" value={activeGameDefinitionSummary.version} icon={Hash} color="text-slate-300" />
          <ToolRow label="Resources" value={activeGameDefinitionSummary.resourceCount} icon={Database} />
          <ToolRow label="Entities" value={activeGameDefinitionSummary.entityCount} icon={Box} />
          <ToolRow label="Actions" value={activeGameDefinitionSummary.actionCount} icon={Activity} />
          <ToolRow label="Systems" value={activeGameDefinitionSummary.systemCount} icon={Layers} />
          <div className="mt-1 px-1 text-[8px] text-slate-500 truncate" title={activeGameDefinitionSummary.genreTags.join(' / ')}>
            {activeGameDefinitionSummary.genreTags.join(' / ')}
          </div>
        </div>
      ) : (
        <div className="text-[9px] text-slate-500 font-mono border border-slate-800 bg-slate-950/45 p-2 rounded-[2px]">No active game pack registered.</div>
      )}
    </div>

    {activeGameDefinitionSummary && <CommandSchemaForm dispatch={dispatch} />}

    <div>
      <h3 className="text-[9px] text-slate-500 font-black uppercase mb-1.5 flex items-center gap-1.5 font-['Rajdhani'] tracking-widest border-b border-slate-800 pb-0.5">
        <Unlock size={10} /> Engine Runtime Tools
      </h3>
      <button
        type="button"
        onClick={() => dispatch({ type: 'TOGGLE_CHEATS' })}
        className={`w-full py-2 px-2 rounded-[2px] font-bold text-[10px] flex items-center justify-between transition-all border border-slate-700 ${state.cheatsEnabled ? 'bg-amber-900/30 text-amber-400 border-amber-600/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-750'}`}
      >
        <span className="font-['Rajdhani'] uppercase tracking-wider">Creative Mode</span>
        {state.cheatsEnabled ? <ToggleRight size={16} className="text-amber-400" /> : <ToggleLeft size={16} className="text-slate-500" />}
      </button>
      <p className="text-[8px] text-slate-500 mt-1 italic leading-tight">
        Bypasses building costs, eco requirements, and tech locks for engine testing.
      </p>

      <button
        type="button"
        onClick={() => {
          if (!fogRemoved) dispatch({ type: 'REMOVE_FOG_OF_WAR' });
        }}
        disabled={fogRemoved}
        className={`w-full mt-3 py-2 px-2 rounded-[2px] font-bold text-[10px] flex items-center justify-between transition-all border ${fogRemoved ? 'bg-emerald-950/30 text-emerald-400 border-emerald-600/50 cursor-default' : 'bg-slate-800 text-slate-400 hover:bg-slate-750 border-slate-700'}`}
        title="Remove fog of war from both map and first-person views"
      >
        <span className="font-['Rajdhani'] uppercase tracking-wider">{fogRemoved ? 'Fog Removed' : 'Remove Fog'}</span>
        {fogRemoved ? <Eye size={16} className="text-emerald-400" /> : <EyeOff size={16} className="text-slate-500" />}
      </button>
      <p className="text-[8px] text-slate-500 mt-1 italic leading-tight">
        Reveals the world by disabling the fog-of-war overlay and first-person mist.
      </p>

      <button
        type="button"
        onClick={() => dispatch({ type: 'TOGGLE_VIEW' })}
        className="w-full mt-3 py-1.5 px-2 rounded-[2px] font-bold text-[9px] flex items-center justify-center gap-2 transition-all border border-emerald-600/50 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/30 uppercase tracking-widest font-['Rajdhani']"
      >
        <Layers size={12} />
        {state.activeView === 'SURFACE' ? 'Switch to Underground' : 'Return to Surface'}
      </button>
    </div>
  </div>
);

export default EngineDevToolsPanel;
