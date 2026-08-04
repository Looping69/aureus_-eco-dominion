
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Coins, Pickaxe, Leaf, Heart, Gem, Users, Target, Trees, Database, Truck, Hammer, Zap } from 'lucide-react';
import { GameState, Era, FactoryResourceType, BuildingType } from '../types';
import { BUILDINGS, ERAS } from '../engine/data/VoxelConstants';

const SECTOR_RESOURCE_LABELS: Record<FactoryResourceType, string> = {
  ORE: 'Ore',
  CONCENTRATE: 'Conc.',
  MINERALS: 'Minerals',
  WOOD: 'Wood',
  STONE: 'Stone',
  GEMS: 'Gems',
  REFINED_MATERIALS: 'Refined',
  ALLOYS: 'Alloys',
  MACHINE_PARTS: 'Parts',
  AUTOMATION_KITS: 'Kits',
};

const getSectorBadge = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

const toPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatHUDNumber = (value: number) => Math.floor(value).toLocaleString();

const getSatisfactionTone = (value: number) => {
  if (value >= 0.75) return 'text-emerald-300';
  if (value >= 0.45) return 'text-amber-300';
  return 'text-rose-300';
};

const isStructureHead = (tile: GameState['chunks'][string]['tiles'][number]) =>
  tile.structureHeadX === undefined || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);

const countCompletedBuildings = (state: GameState, type?: BuildingType) => Object.values(state.chunks)
  .flatMap(chunk => chunk.tiles)
  .filter(tile => tile.buildingType !== BuildingType.EMPTY && !tile.isUnderConstruction && isStructureHead(tile))
  .filter(tile => !type || tile.buildingType === type)
  .length;

interface EraRequirementRow {
  label: string;
  current: number;
  target: number;
  met: boolean;
}

const getEraRequirementRows = (state: GameState, nextEra: Era | null): EraRequirementRow[] => {
  if (!nextEra) return [];
  const conditions = ERAS[nextEra].unlockConditions as typeof ERAS[Era.SETTLEMENT]['unlockConditions'] & { requiredBuildings?: BuildingType[] };
  const rows: EraRequirementRow[] = [];

  if (conditions.minColonists) {
    const current = state.agents.filter(agent => agent.type !== 'ILLEGAL_MINER').length;
    rows.push({ label: 'Colonists', current, target: conditions.minColonists, met: current >= conditions.minColonists });
  }
  if (conditions.minAgt) {
    rows.push({ label: 'AGT', current: Math.floor(state.resources.agt), target: conditions.minAgt, met: state.resources.agt >= conditions.minAgt });
  }
  if (conditions.minEco) {
    rows.push({ label: 'Eco', current: Math.floor(state.resources.eco), target: conditions.minEco, met: state.resources.eco >= conditions.minEco });
  }
  if (conditions.minTrust) {
    rows.push({ label: 'Trust', current: Math.floor(state.resources.trust), target: conditions.minTrust, met: state.resources.trust >= conditions.minTrust });
  }
  if (conditions.minBuildings) {
    const current = countCompletedBuildings(state);
    rows.push({ label: 'Buildings', current, target: conditions.minBuildings, met: current >= conditions.minBuildings });
  }
  for (const buildingType of conditions.requiredBuildings || []) {
    const current = countCompletedBuildings(state, buildingType);
    rows.push({
      label: BUILDINGS[buildingType]?.name || buildingType,
      current: Math.min(1, current),
      target: 1,
      met: current > 0,
    });
  }

  return rows;
};

const ResourceBlock = React.memo(({ icon: Icon, val, label, borderClass, iconBgClass, sub, textColor = "text-white", isExpanded, onToggle }: any) => {
  const [popup, setPopup] = useState<{ id: number; text: string; isPositive: boolean } | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const prevValRef = useRef(Math.floor(val));
  const counterRef = useRef(0);

  useEffect(() => {
    const currentInt = Math.floor(val);
    const diff = currentInt - prevValRef.current;

    if (Math.abs(diff) >= 1) {
      const id = ++counterRef.current;
      const text = `${diff > 0 ? '+' : ''}${diff}`;
      setPopup({ id, text, isPositive: diff > 0 });

      if (!isExpanded && diff > 0) {
        setHasNew(true);
      }

      const timer = setTimeout(() => {
        setPopup(current => current?.id === id ? null : current);
      }, 600);
      prevValRef.current = currentInt;
      return () => clearTimeout(timer);
    } else {
      prevValRef.current = currentInt;
    }
  }, [val, isExpanded]);

  const handleToggle = () => {
    onToggle(!isExpanded);
    if (!isExpanded) {
      setHasNew(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center pointer-events-auto">
      {popup && isExpanded && (
        <div
          key={popup.id}
          className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black z-50 pointer-events-none resource-popup ${popup.isPositive ? 'text-emerald-400 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]' : 'text-rose-400 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]'}`}
        >
          {popup.text}
        </div>
      )}

      <button
        onClick={handleToggle}
        className={`
          flex items-center gap-1.5 sm:gap-2.5 
          bg-slate-900 
          border-2 ${borderClass} 
          rounded-[4px] px-2 py-1 sm:px-3 sm:py-2
          ${isExpanded ? 'min-w-[65px] sm:min-w-[80px]' : 'w-10 h-10 sm:w-12 sm:h-12 justify-center'}
          shadow-[4px_4px_0px_0px_rgba(0,0,0,0.4)]
          transition-all duration-200
          hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.3)]
          relative
        `}
      >
        {!isExpanded && hasNew && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse z-10" />
        )}

        <div className={`
          w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-[3px] 
          ${iconBgClass} text-slate-900 border border-black/20 shadow-inner shrink-0
        `}>
          <Icon size={12} className="sm:hidden" strokeWidth={2.5} />
          <Icon size={16} className="hidden sm:block" strokeWidth={2.5} />
        </div>

        {isExpanded && (
          <div className="flex flex-col items-start leading-none gap-0.5 animate-in fade-in slide-in-from-left-1 duration-200">
            <span className="text-[7px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-xs sm:text-sm font-['Rajdhani'] font-bold ${textColor} tracking-wide leading-none`}>{formatHUDNumber(val)}</span>
              {sub !== undefined && (
                <span className={`text-[7px] sm:text-[9px] font-mono font-bold ${sub < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {sub > 0 ? '▲' : sub < 0 ? '▼' : ''}
                </span>
              )}
            </div>
          </div>
        )}
      </button>
    </div>
  );
});

interface HUDProps {
  resources: GameState['resources'];
  financials: { net: number };
  population: number;
  currentEra: Era;
  state: GameState;
  activeBlock: string | null;
  onToggleBlock: (id: string | null) => void;
}

const EraBlock = ({ currentEra, state, isExpanded, onToggle }: { currentEra: Era; state: GameState, isExpanded: boolean, onToggle: (open: boolean) => void }) => {
  const [hasNew, setHasNew] = useState(false);
  const prevProgressRef = useRef(0);
  const eraDef = ERAS[currentEra];
  const eras = Object.values(Era);
  const nextEraIndex = eras.indexOf(currentEra) + 1;
  const nextEra = nextEraIndex < eras.length ? eras[nextEraIndex] : null;
  const nextDef = nextEra ? ERAS[nextEra] : null;
  const requirementRows = getEraRequirementRows(state, nextEra);
  const metReqs = requirementRows.filter(row => row.met).length;
  const progress = requirementRows.length > 0
    ? (requirementRows.reduce((sum, row) => sum + Math.min(1, row.current / row.target), 0) / requirementRows.length) * 100
    : 0;

  if (nextDef) {
    if (!isExpanded && progress > prevProgressRef.current + 0.1) {
      setHasNew(true);
    }
    prevProgressRef.current = progress;
  }

  const handleToggle = () => {
    onToggle(!isExpanded);
    if (!isExpanded) {
      setHasNew(false);
    }
  };

  return (
    <div className="relative group pointer-events-auto">
      <button
        onClick={handleToggle}
        className={`
          flex items-start gap-1.5 sm:gap-2.5 
          bg-slate-900 
          border-2 border-slate-700
          rounded-[4px] px-2 py-1 sm:px-3 sm:py-2
          ${isExpanded ? 'min-w-[240px] max-w-[280px]' : 'w-10 h-10 sm:w-12 sm:h-12 justify-center items-center'}
          shadow-[4px_4px_0px_0px_rgba(0,0,0,0.4)]
          transition-all duration-200
          hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.3)]
          cursor-help
          relative
        `}
      >
        <div className={`
          w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-[3px] bg-slate-700 text-white shrink-0 shadow-inner
          ${!isExpanded && hasNew ? 'animate-pulse ring-2 ring-emerald-500' : ''}
        `} style={!isExpanded ? { backgroundColor: eraDef.color } : {}}>
          <Target size={14} strokeWidth={2.5} />
          {!isExpanded && hasNew && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse z-10" />
          )}
        </div>

        {isExpanded && (
          <div className="flex flex-col items-start leading-none gap-1.5 pr-2 animate-in fade-in slide-in-from-left-1 duration-200 text-left min-w-0 flex-1">
            <span className="text-[7px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-wider">Evolution</span>
            <span className="text-xs sm:text-sm font-['Rajdhani'] font-bold text-white tracking-wide truncate max-w-full">{eraDef.name.replace('Era ', 'E')}</span>
            {nextDef && (
              <div className="w-full pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between gap-2 text-[8px] sm:text-[9px] font-mono uppercase tracking-wider mb-1">
                  <span className="text-slate-500">Next</span>
                  <span className="text-amber-300">{metReqs}/{requirementRows.length}</span>
                </div>
                <div className="space-y-1">
                  {requirementRows.slice(0, 6).map(row => (
                    <div key={row.label} className="flex items-center justify-between gap-2 text-[8px] sm:text-[9px] font-mono">
                      <span className={row.met ? 'text-emerald-300 truncate' : 'text-slate-400 truncate'}>{row.label}</span>
                      <span className={row.met ? 'text-emerald-300 shrink-0' : 'text-amber-300 shrink-0'}>{row.current}/{row.target}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {nextDef && isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-950/50 rounded-b-[2px] overflow-hidden">
            <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: eraDef.color }} />
            {nextDef.milestones?.map((m: any, i: number) => (
              <div
                key={m.id}
                className={`absolute top-0 bottom-0 w-0.5 z-10 ${progress >= ((i + 1) / (nextDef.milestones!.length + 1)) * 100 ? 'bg-white/40' : 'bg-black/40'}`}
                style={{ left: `${((i + 1) / (nextDef.milestones!.length + 1)) * 100}%` }}
              />
            ))}
          </div>
        )}

        {!isExpanded && nextDef && (
          <div className="absolute bottom-1 left-1.5 right-1.5 h-0.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: eraDef.color }} />
          </div>
        )}
      </button>
    </div>
  );
};

const MarketBlock = ({ state, isExpanded, onToggle }: { state: GameState; isExpanded: boolean; onToggle: (open: boolean) => void }) => {
  const sectors = [...(state.factory?.sectors || [])].sort((a, b) => {
    if (b.throughput !== a.throughput) return b.throughput - a.throughput;
    return b.stationCount - a.stationCount;
  });
  const visibleSectors = sectors.slice(0, 3);
  const rechargePads = state.factory?.rechargePads || 0;
  const railFlow = Math.floor(state.factory?.regionalThroughput || 0);
  const routeDebt = Math.round(state.factory?.pressure?.routeDebt || 0);
  const underfed = state.factory?.pressure?.underfedProcessors || 0;
  const hotspots = state.factory?.pressure?.hotspots || 0;
  const [hasNew, setHasNew] = useState(false);
  const prevSectorSignature = useRef('');

  useEffect(() => {
    const signature = visibleSectors
      .map((sector) => `${sector.name}:${Math.round(sector.throughput)}:${sector.exportFocus}:${sector.importFocus}:${Math.round((sector.satisfaction ?? 0.72) * 100)}:${sector.bonusChain ?? 0}`)
      .join('|');
    if (signature && prevSectorSignature.current && signature !== prevSectorSignature.current && !isExpanded) {
      setHasNew(true);
    }
    prevSectorSignature.current = signature;
  }, [isExpanded, visibleSectors]);

  const handleToggle = () => {
    onToggle(!isExpanded);
    if (!isExpanded) {
      setHasNew(false);
    }
  };

  return (
    <div className="relative group pointer-events-auto">
      <button
        onClick={handleToggle}
        className={`
          flex items-start gap-2 sm:gap-3 
          bg-slate-900 
          border-2 border-cyan-700/80
          rounded-[4px] px-2 py-1 sm:px-3 sm:py-2
          ${isExpanded ? 'min-w-[220px] sm:min-w-[260px]' : 'w-10 h-10 sm:w-12 sm:h-12 justify-center'}
          shadow-[4px_4px_0px_0px_rgba(0,0,0,0.4)]
          transition-all duration-200
          hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.3)]
          relative
        `}
      >
        {!isExpanded && hasNew && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse z-10" />
        )}

        <div className="w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-[3px] bg-cyan-500 text-slate-900 border border-black/20 shadow-inner shrink-0">
          <Truck size={12} className="sm:hidden" strokeWidth={2.5} />
          <Truck size={16} className="hidden sm:block" strokeWidth={2.5} />
        </div>

        {isExpanded && (
          <div className="flex flex-col items-start gap-1.5 pr-1 animate-in fade-in slide-in-from-left-1 duration-200 text-left">
            <div className="flex items-baseline gap-2">
              <span className="text-[7px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-wider">Market</span>
              <span className="text-[7px] sm:text-[9px] text-cyan-200 font-mono">{sectors.length} sectors</span>
            </div>

            {visibleSectors.length > 0 ? visibleSectors.map((sector) => {
              const satisfaction = sector.satisfaction ?? 0.72;
              const bonusChain = sector.bonusChain ?? 0;

              return (
                <div key={sector.name} className="w-full border border-cyan-950/70 bg-slate-950/70 rounded-[3px] px-2 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[8px] sm:text-[9px] font-black text-cyan-300 bg-cyan-950/80 border border-cyan-800 rounded-[2px] px-1.5 py-0.5 shrink-0">
                        {getSectorBadge(sector.name)}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-white font-semibold truncate max-w-[108px] sm:max-w-[138px]">{sector.name}</span>
                    </div>
                    <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono shrink-0">{Math.round(sector.throughput)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] sm:text-[9px] font-mono text-slate-300">
                    <span>Out {SECTOR_RESOURCE_LABELS[sector.exportFocus]} +{toPercent(sector.exportBonus)}</span>
                    <span>In {SECTOR_RESOURCE_LABELS[sector.importFocus]} -{toPercent(sector.importDiscount)}</span>
                    <span>Demand +{toPercent(sector.demandBonus)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] sm:text-[9px] font-mono">
                    <span className={getSatisfactionTone(satisfaction)}>Sat {toPercent(satisfaction)}</span>
                    <span className="text-lime-300">Chain x{bonusChain}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="text-[8px] sm:text-[9px] text-slate-500 font-mono">Build rail hubs to read regional demand.</div>
            )}

            <div className="text-[8px] sm:text-[9px] text-slate-400 font-mono">
              Pads {rechargePads} · Rail {railFlow} · Debt {routeDebt} · Feed {underfed} · Hot {hotspots}
            </div>
          </div>
        )}
      </button>
    </div>
  );
};

const HUDSummaryPill = ({ label, value, tone = 'text-slate-200' }: { label: string; value: React.ReactNode; tone?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-[3px] border border-slate-700/80 bg-slate-950/80 px-1.5 py-0.5 font-mono text-[8px] leading-none text-slate-500 sm:text-[9px]">
    <span>{label}</span>
    <span className={`font-black ${tone}`}>{value}</span>
  </span>
);

interface HUDClusterProps {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  summary: React.ReactNode;
  className?: string;
}

const HUDCluster = ({ label, collapsed, onToggle, children, summary, className = '' }: HUDClusterProps) => {
  const contentId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-hud-cluster`;

  return (
    <section className={`pointer-events-auto min-w-0 rounded-[4px] border border-slate-800/70 bg-slate-950/45 px-1.5 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-colors duration-200 hover:border-slate-700/90 ${className}`} aria-label={`${label} HUD cluster`}>
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={contentId}
        onClick={onToggle}
        className="group flex w-full items-center justify-between gap-2 rounded-[3px] px-1 py-0.5 text-left transition-colors duration-200 hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDown size={13} strokeWidth={3} className={`shrink-0 text-slate-500 transition-transform duration-300 ease-out ${collapsed ? '-rotate-90' : 'rotate-0'}`} />
          <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-slate-400/90 font-mono">{label}</span>
        </div>
        <div className="flex min-w-0 flex-1 justify-end gap-1 overflow-hidden transition-opacity duration-200 group-hover:opacity-100 sm:gap-1.5">
          {summary}
        </div>
      </button>
      <div
        id={contentId}
        className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out ${collapsed ? 'pointer-events-none -translate-y-1 opacity-0' : 'translate-y-0 opacity-100'}`}
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-start gap-2 pt-2 sm:gap-2.5 pointer-events-none">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};

const CLUSTER_BLOCK_IDS: Record<string, string[]> = {
  core: ['era', 'agt', 'eco', 'trust', 'pop'],
  materials: ['minerals', 'wood', 'stone', 'gems'],
  industry: ['refined', 'alloys', 'parts', 'kits', 'chains', 'grid', 'flow', 'rail', 'charge', 'market'],
};

export const HUD: React.FC<HUDProps> = React.memo(({ resources, financials, population, currentEra, state, activeBlock, onToggleBlock }) => {
  const [collapsedClusters, setCollapsedClusters] = useState<Record<string, boolean>>({});

  const toggleBlock = (id: string, isOpen: boolean) => {
    onToggleBlock(isOpen ? id : null);
  };

  const toggleCluster = (clusterId: keyof typeof CLUSTER_BLOCK_IDS) => {
    const nextCollapsed = !collapsedClusters[clusterId];
    setCollapsedClusters(prev => ({ ...prev, [clusterId]: nextCollapsed }));

    if (nextCollapsed && activeBlock && CLUSTER_BLOCK_IDS[clusterId].includes(activeBlock)) {
      onToggleBlock(null);
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none px-2 pt-3 sm:px-4 sm:pt-4">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-2 sm:flex-row sm:items-start sm:justify-center sm:gap-3">
        <HUDCluster
          label="Core"
          collapsed={collapsedClusters.core === true}
          onToggle={() => toggleCluster('core')}
          className="sm:max-w-[28rem]"
          summary={(
            <>
              <HUDSummaryPill label="AGT" value={formatHUDNumber(resources.agt)} tone="text-amber-300" />
              <HUDSummaryPill label="Eco" value={formatHUDNumber(resources.eco)} tone="text-emerald-300" />
              <HUDSummaryPill label="Pop" value={formatHUDNumber(population)} tone="text-blue-300" />
            </>
          )}
        >
          <EraBlock currentEra={currentEra} state={state} isExpanded={activeBlock === 'era'} onToggle={(open) => toggleBlock('era', open)} />
          <ResourceBlock icon={Coins} val={resources.agt} label="AGT" borderClass="border-amber-600/80" iconBgClass="bg-amber-500" sub={financials.net} isExpanded={activeBlock === 'agt'} onToggle={(open: boolean) => toggleBlock('agt', open)} />
          <ResourceBlock icon={Leaf} val={resources.eco} label="Eco" borderClass="border-emerald-600/80" iconBgClass="bg-emerald-500" isExpanded={activeBlock === 'eco'} onToggle={(open: boolean) => toggleBlock('eco', open)} />
          <ResourceBlock icon={Heart} val={resources.trust} label="Trust" borderClass="border-rose-600/80" iconBgClass="bg-rose-500" isExpanded={activeBlock === 'trust'} onToggle={(open: boolean) => toggleBlock('trust', open)} />
          <ResourceBlock icon={Users} val={population} label="Pop" borderClass="border-blue-600/80" iconBgClass="bg-blue-500" isExpanded={activeBlock === 'pop'} onToggle={(open: boolean) => toggleBlock('pop', open)} />
        </HUDCluster>

        <HUDCluster
          label="Materials"
          collapsed={collapsedClusters.materials === true}
          onToggle={() => toggleCluster('materials')}
          className="sm:max-w-[21rem]"
          summary={(
            <>
              <HUDSummaryPill label="Ore" value={formatHUDNumber(resources.minerals)} />
              <HUDSummaryPill label="Wood" value={formatHUDNumber(resources.wood)} />
              <HUDSummaryPill label="Stone" value={formatHUDNumber(resources.stone)} />
            </>
          )}
        >
          <ResourceBlock icon={Pickaxe} val={resources.minerals} label="Ore" borderClass="border-slate-500/80" iconBgClass="bg-slate-400" isExpanded={activeBlock === 'minerals'} onToggle={(open: boolean) => toggleBlock('minerals', open)} />
          <ResourceBlock icon={Trees} val={resources.wood} label="Wood" borderClass="border-amber-700/80" iconBgClass="bg-amber-900" isExpanded={activeBlock === 'wood'} onToggle={(open: boolean) => toggleBlock('wood', open)} />
          <ResourceBlock icon={Database} val={resources.stone} label="Stone" borderClass="border-slate-400/80" iconBgClass="bg-slate-600" isExpanded={activeBlock === 'stone'} onToggle={(open: boolean) => toggleBlock('stone', open)} />
          <ResourceBlock icon={Gem} val={resources.gems} label="Thundergems" borderClass="border-purple-600/80" iconBgClass="bg-purple-500" textColor="text-purple-300" isExpanded={activeBlock === 'gems'} onToggle={(open: boolean) => toggleBlock('gems', open)} />
        </HUDCluster>

        <HUDCluster
          label="Industry / Logistics"
          collapsed={collapsedClusters.industry === true}
          onToggle={() => toggleCluster('industry')}
          className="sm:max-w-[45rem]"
          summary={(
            <>
              <HUDSummaryPill label="Grid" value={formatHUDNumber(state.industry?.gridLoad || 0)} tone="text-yellow-300" />
              <HUDSummaryPill label="Flow" value={formatHUDNumber(state.factory?.throughput || 0)} tone="text-cyan-300" />
              <HUDSummaryPill label="Rail" value={formatHUDNumber(state.factory?.regionalThroughput || 0)} tone="text-sky-300" />
            </>
          )}
        >
          <ResourceBlock icon={Database} val={state.industry?.refinedMaterials || 0} label="Refined" borderClass="border-sky-600/80" iconBgClass="bg-sky-400" textColor="text-sky-100" isExpanded={activeBlock === 'refined'} onToggle={(open: boolean) => toggleBlock('refined', open)} />
          <ResourceBlock icon={Gem} val={state.industry?.alloys || 0} label="Alloys" borderClass="border-violet-600/80" iconBgClass="bg-violet-400" textColor="text-violet-100" isExpanded={activeBlock === 'alloys'} onToggle={(open: boolean) => toggleBlock('alloys', open)} />
          <ResourceBlock icon={Hammer} val={state.industry?.machineParts || 0} label="Parts" borderClass="border-orange-600/80" iconBgClass="bg-orange-400" textColor="text-orange-100" isExpanded={activeBlock === 'parts'} onToggle={(open: boolean) => toggleBlock('parts', open)} />
          <ResourceBlock icon={Truck} val={state.industry?.automationKits || 0} label="Kits" borderClass="border-teal-600/80" iconBgClass="bg-teal-400" textColor="text-teal-100" isExpanded={activeBlock === 'kits'} onToggle={(open: boolean) => toggleBlock('kits', open)} />
          <ResourceBlock icon={Hammer} val={state.industry?.automatedChains || 0} label="Chains" borderClass="border-lime-600/80" iconBgClass="bg-lime-400" textColor="text-lime-100" isExpanded={activeBlock === 'chains'} onToggle={(open: boolean) => toggleBlock('chains', open)} />
          <ResourceBlock icon={Zap} val={state.industry?.gridLoad || 0} label="Grid" borderClass="border-yellow-500/80" iconBgClass="bg-yellow-400" textColor="text-yellow-100" sub={state.powerGrid?.strandedDemand ? -Math.floor(state.powerGrid.strandedDemand) : undefined} isExpanded={activeBlock === 'grid'} onToggle={(open: boolean) => toggleBlock('grid', open)} />
          <ResourceBlock icon={Truck} val={state.factory?.throughput || 0} label="Flow" borderClass="border-cyan-600/80" iconBgClass="bg-cyan-500" textColor="text-cyan-200" isExpanded={activeBlock === 'flow'} onToggle={(open: boolean) => toggleBlock('flow', open)} />
          <ResourceBlock icon={Truck} val={state.factory?.regionalThroughput || 0} label="Rail" borderClass="border-sky-700/80" iconBgClass="bg-sky-500" textColor="text-sky-100" isExpanded={activeBlock === 'rail'} onToggle={(open: boolean) => toggleBlock('rail', open)} />
          <ResourceBlock icon={Zap} val={(state.factory?.droneCharge || 0) * 100} label="Charge" borderClass="border-emerald-700/80" iconBgClass="bg-emerald-400" textColor="text-emerald-100" sub={state.factory?.droneUpkeep ? -Math.floor(state.factory.droneUpkeep) : undefined} isExpanded={activeBlock === 'charge'} onToggle={(open: boolean) => toggleBlock('charge', open)} />
          <MarketBlock state={state} isExpanded={activeBlock === 'market'} onToggle={(open) => toggleBlock('market', open)} />
        </HUDCluster>
      </div>
    </div>
  );
});