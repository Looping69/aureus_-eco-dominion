import React from 'react';
import { ChevronUp, Maximize2, Radio, Signal, Trees, Users, Zap } from 'lucide-react';
import { BuildingType, Era, GameState, SfxType } from '../types';
import { BUILDINGS } from '../engine/data/VoxelConstants';

interface NarrativePanelProps {
    state: GameState;
    playSfx: (sfx: any) => void;
}

type SignalTone = 'good' | 'warn' | 'danger' | 'neutral';

type Dispatch = {
    chapter: string;
    title: string;
    body: string;
    crew: string;
    community: string;
    land: string;
    tone: SignalTone;
};

const STORAGE_KEY = 'aureus_narrative_panel_collapsed';

const ERA_CHAPTER: Record<Era, string> = {
    [Era.SETTLEMENT]: 'Chapter I: Dust Claim',
    [Era.GROWTH]: 'Chapter II: The Camp Becomes A Town',
    [Era.INDUSTRY]: 'Chapter III: Iron Under The Grass',
    [Era.SUSTAINABILITY]: 'Chapter IV: Debt To The Land',
    [Era.PROSPERITY]: 'Chapter V: Dominion Or Stewardship',
};

function readInitialCollapsed(): boolean {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
}

function isStructureHead(tile: GameState['chunks'][string]['tiles'][number]): boolean {
    return tile.structureHeadX === undefined || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);
}

function countBuildings(state: GameState, type?: BuildingType): number {
    return Object.values(state.chunks)
        .flatMap(chunk => chunk.tiles)
        .filter(tile => tile.buildingType !== BuildingType.EMPTY && !tile.isUnderConstruction && isStructureHead(tile))
        .filter(tile => !type || tile.buildingType === type)
        .length;
}

function getEraName(era: Era): string {
    return ERA_CHAPTER[era] || 'Field Log';
}

function getDispatch(state: GameState): Dispatch {
    const readyContract = state.contracts.find(contract => contract.status === 'READY_TO_DELIVER');
    const acceptedContract = state.contracts.find(contract => contract.status === 'ACCEPTED');
    const availableContract = state.contracts.find(contract => (contract.status || 'AVAILABLE') === 'AVAILABLE');
    const completedBuildings = countBuildings(state);
    const staffQuarters = countBuildings(state, BuildingType.STAFF_QUARTERS);
    const storage = countBuildings(state, BuildingType.STORAGE_DEPOT) + countBuildings(state, BuildingType.STOCKPILE);
    const mines = countBuildings(state, BuildingType.MINING_HEADFRAME) + countBuildings(state, BuildingType.WASH_PLANT);
    const chapter = getEraName(state.currentEra);

    if (readyContract) {
        return {
            chapter,
            title: 'The convoy is waiting at the gate',
            body: `${readyContract.amount} ${readyContract.resource.toLowerCase()} are stacked, tagged, and ready. Delivering now turns the mine from a promise into payroll.`,
            crew: 'Drivers are asking for clearance codes.',
            community: 'The district office is watching whether Aureus keeps its word.',
            land: state.resources.eco < 45 ? 'Dust hangs low over the haul road.' : 'The morning air is clear enough for a clean departure.',
            tone: 'good',
        };
    }

    if ((state.powerGrid?.deficit || 0) > 0 || (state.waterNetwork?.deficit || 0) > 0) {
        const problem = (state.powerGrid?.deficit || 0) > 0 ? 'power' : 'water';
        return {
            chapter,
            title: `The settlement is short on ${problem}`,
            body: `Work has not stopped, but everyone can feel the strain. Fixing ${problem} will make the colony feel less like a camp and more like a place that can last.`,
            crew: 'Foremen are rationing active equipment.',
            community: 'Families trust systems they can see working.',
            land: problem === 'water' ? 'Dry ground is starting to show around the pumps.' : 'The night grid flickers across the valley.',
            tone: 'warn',
        };
    }

    if (acceptedContract) {
        const resource = acceptedContract.resource.toLowerCase();
        return {
            chapter,
            title: `A promise is open: ${resource} delivery`,
            body: `The contract is no longer just a number. Someone downstream planned around this shipment. Produce, stockpile, and deliver before the timer turns reputation into debt.`,
            crew: 'Workers know exactly what the next shipment needs.',
            community: `The buyer needs ${acceptedContract.amount} ${resource}, not excuses.`,
            land: state.resources.eco < 50 ? 'Every load leaves a visible scar. Restore as you extract.' : 'The claim can still be worked carefully.',
            tone: 'neutral',
        };
    }

    if (state.activeGoal && !state.activeGoal.completed) {
        return {
            chapter,
            title: state.activeGoal.title,
            body: state.activeGoal.description,
            crew: state.jobs.length > 0 ? `${state.jobs.length} job orders are circulating among the crew.` : 'The crew is waiting for the next clear order.',
            community: state.resources.trust < 35 ? 'Local confidence is thin. Small wins matter now.' : 'Word is spreading that the settlement might hold.',
            land: state.resources.eco < 45 ? 'The land is absorbing more damage than it can hide.' : 'Wild grass still pushes through the work grid.',
            tone: state.activeGoal.completed ? 'good' : 'neutral',
        };
    }

    if (staffQuarters === 0) {
        return {
            chapter,
            title: 'No one believes in a mine without beds',
            body: 'Before the first proper shipment, the workers need a place to sleep. Staff Quarters are the first promise Aureus makes to its own people.',
            crew: 'Three founders are living out of field packs.',
            community: 'The nearest village is listening for whether jobs become homes.',
            land: 'The claim is quiet except for wind and survey flags.',
            tone: 'warn',
        };
    }

    if (storage === 0) {
        return {
            chapter,
            title: 'Ore on the ground is not wealth',
            body: 'Build storage so every harvest has somewhere to go. A colony without stockpiles leaks effort into the dust.',
            crew: 'Workers need a depot before production feels real.',
            community: 'The first reliable delivery will decide the camp reputation.',
            land: 'Tracks are forming where none existed yesterday.',
            tone: 'neutral',
        };
    }

    if (mines === 0) {
        return {
            chapter,
            title: 'The ground has not answered yet',
            body: 'Aureus came for what lies under the soil. Build the first mineral chain and the whole settlement finally gets a heartbeat.',
            crew: 'Surveyors have marked promising seams near the claim.',
            community: 'Buyers want proof this is more than a charter document.',
            land: 'Birds lift from the tree line whenever the drills start.',
            tone: 'neutral',
        };
    }

    if (availableContract) {
        return {
            chapter,
            title: 'There is money on the wire',
            body: `A buyer has posted a live demand for ${availableContract.amount} ${availableContract.resource.toLowerCase()}. Accept only when the colony can honor the clock.`,
            crew: 'The depot crew is checking stock against the offer.',
            community: 'Every completed contract buys trust as much as equipment.',
            land: state.resources.eco < 55 ? 'Extraction pressure is rising. Watch the eco line.' : 'The concession still has room to breathe.',
            tone: 'good',
        };
    }

    if (state.resources.eco < 35) {
        return {
            chapter,
            title: 'The land is starting to remember every cut',
            body: 'Eco integrity is low. Restoration is no longer decoration; it is survival, pricing, weather, and reputation tied together.',
            crew: 'Crews are reporting dust, heat, and harder days.',
            community: 'Trust will fall if Aureus becomes another scar on the map.',
            land: 'Bare earth is spreading between the work sites.',
            tone: 'danger',
        };
    }

    return {
        chapter,
        title: completedBuildings > 8 ? 'The camp has a pulse now' : 'A small signal in a very large valley',
        body: 'Keep the loop alive: build what people need, produce what the market demands, deliver what you promised, and leave enough green behind to call it civilization.',
        crew: `${state.agents.filter(agent => agent.type !== 'ILLEGAL_MINER').length} colonists are on the roster.`,
        community: state.resources.trust >= 60 ? 'Local trust is becoming a real asset.' : 'Trust is still fragile. Contracts can change that.',
        land: state.dayNightCycle?.isDaytime ? 'Daylight exposes every good decision and every shortcut.' : 'Night settles over the claim; the radios sound louder now.',
        tone: 'neutral',
    };
}

function getToneClasses(tone: SignalTone): string {
    if (tone === 'good') return 'border-emerald-700 bg-emerald-950/35 text-emerald-200';
    if (tone === 'warn') return 'border-amber-700 bg-amber-950/35 text-amber-200';
    if (tone === 'danger') return 'border-rose-700 bg-rose-950/40 text-rose-200';
    return 'border-slate-700 bg-slate-900/80 text-slate-200';
}

export const NarrativePanel: React.FC<NarrativePanelProps> = ({ state, playSfx }) => {
    const [collapsed, setCollapsed] = React.useState(readInitialCollapsed);
    const dispatch = React.useMemo(() => getDispatch(state), [state]);
    const toneClasses = getToneClasses(dispatch.tone);

    React.useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false');
    }, [collapsed]);

    const toggle = () => {
        setCollapsed(value => !value);
        playSfx(SfxType.UI_CLICK);
    };

    if (collapsed) {
        return (
            <button
                onClick={toggle}
                title={`Radio Dispatch: ${dispatch.title}`}
                aria-label="Expand Radio Dispatch"
                className="relative pointer-events-auto w-11 h-11 rounded-[6px] border border-amber-800 bg-slate-950/88 shadow-[3px_3px_0_rgba(0,0,0,0.35)] backdrop-blur-md flex items-center justify-center hover:bg-slate-900/90 transition-colors"
            >
                <Radio size={19} className="text-amber-300" />
                <Maximize2 size={9} className="absolute top-1 right-1 text-slate-500" />
                <span className="absolute -bottom-1 left-1 rounded bg-slate-950 px-1 text-[7px] font-black uppercase tracking-wider text-amber-300 border border-amber-900/70">
                    Story
                </span>
            </button>
        );
    }

    return (
        <div className="w-[22rem] max-w-[calc(100vw-1rem)] pointer-events-auto">
            <div className="bg-slate-950/90 backdrop-blur-md border border-amber-900/70 shadow-[4px_4px_0_rgba(0,0,0,0.35)] rounded-[6px] overflow-hidden">
                <button
                    onClick={toggle}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 border-b border-amber-950/80 bg-slate-900/80 hover:bg-slate-800/80 transition-colors text-left"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Radio size={15} className="text-amber-300" />
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-wider text-white">Radio Dispatch</div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80 truncate">{dispatch.chapter}</div>
                        </div>
                    </div>
                    <ChevronUp size={14} className="text-slate-400" />
                </button>

                <div className="p-2 space-y-2">
                    <div className={`border rounded-[5px] p-2 ${toneClasses}`}>
                        <div className="text-[11px] font-black uppercase tracking-wide text-white leading-tight">{dispatch.title}</div>
                        <div className="mt-1 text-[10px] font-semibold leading-snug text-slate-200">{dispatch.body}</div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                        <SignalRow icon={Users} label="Crew" text={dispatch.crew} />
                        <SignalRow icon={Signal} label="Community" text={dispatch.community} />
                        <SignalRow icon={Trees} label="Land" text={dispatch.land} />
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                        <MiniMetric label="Trust" value={Math.floor(state.resources.trust)} suffix="%" />
                        <MiniMetric label="Eco" value={Math.floor(state.resources.eco)} suffix="%" />
                        <MiniMetric label="Sites" value={countBuildings(state)} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const SignalRow: React.FC<{ icon: React.ElementType; label: string; text: string }> = ({ icon: Icon, label, text }) => (
    <div className="flex gap-2 bg-slate-900/85 border border-slate-800 rounded-[4px] px-2 py-1.5">
        <Icon size={12} className="text-amber-300 mt-0.5 shrink-0" />
        <div className="min-w-0">
            <div className="text-[8px] font-black uppercase tracking-wider text-slate-500">{label}</div>
            <div className="text-[10px] font-bold text-slate-300 leading-snug">{text}</div>
        </div>
    </div>
);

const MiniMetric: React.FC<{ label: string; value: number; suffix?: string }> = ({ label, value, suffix = '' }) => (
    <div className="bg-slate-950/80 border border-slate-800 rounded px-1.5 py-1">
        <div className="text-slate-500 uppercase font-bold">{label}</div>
        <div className="text-white font-bold flex items-center gap-1">
            {label === 'Eco' && <Zap size={9} className="text-emerald-300" />}
            {value.toLocaleString()}{suffix}
        </div>
    </div>
);
