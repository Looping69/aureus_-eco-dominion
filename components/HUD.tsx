
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { Coins, Pickaxe, Leaf, Heart, Gem, Users } from 'lucide-react';
import { GameState } from '../types';

const ResourceBlock = React.memo(({ icon: Icon, val, label, borderClass, iconBgClass, sub, textColor = "text-white" }: any) => {
  const [popup, setPopup] = useState<{ id: number; text: string; isPositive: boolean } | null>(null);
  const prevValRef = useRef(Math.floor(val));
  const counterRef = useRef(0);

  useEffect(() => {
    const currentInt = Math.floor(val);
    const diff = currentInt - prevValRef.current;
    
    // Only trigger popup on integer changes to save performance
    if (Math.abs(diff) >= 1) {
      const id = ++counterRef.current;
      const text = `${diff > 0 ? '+' : ''}${diff}`;
      setPopup({ id, text, isPositive: diff > 0 });
      
      const timer = setTimeout(() => {
        setPopup(current => current?.id === id ? null : current);
      }, 600);
      prevValRef.current = currentInt;
      return () => clearTimeout(timer);
    } else {
        // Just update ref without trigger
        prevValRef.current = currentInt;
    }
  }, [val]);

  return (
    <div className="relative flex flex-col items-center group pointer-events-auto">
      {popup && (
        <div 
          key={popup.id}
          className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black z-50 pointer-events-none resource-popup ${popup.isPositive ? 'text-emerald-400 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]' : 'text-rose-400 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]'}`}
        >
          {popup.text}
        </div>
      )}
      
      <div className={`
        flex items-center gap-1.5 sm:gap-2.5 
        bg-slate-900 
        border-2 ${borderClass} 
        rounded-[4px] px-2 py-1 sm:px-3 sm:py-2 min-w-[65px] sm:min-w-[80px]
        shadow-[4px_4px_0px_0px_rgba(0,0,0,0.4)]
        transition-transform duration-100
        hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.3)]
      `}>
        {/* Icon Block */}
        <div className={`
          w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-[3px] 
          ${iconBgClass} text-slate-900 border border-black/20 shadow-inner shrink-0
        `}>
          <Icon size={12} className="sm:hidden" strokeWidth={2.5} />
          <Icon size={16} className="hidden sm:block" strokeWidth={2.5} />
        </div>

        {/* Text Stack */}
        <div className="flex flex-col items-start leading-none gap-0.5">
          <span className="text-[7px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
          <div className="flex items-baseline gap-1">
               <span className={`text-xs sm:text-sm font-['Rajdhani'] font-bold ${textColor} tracking-wide leading-none`}>{Math.floor(val).toLocaleString()}</span>
               {sub !== undefined && (
                 <span className={`text-[7px] sm:text-[9px] font-mono font-bold ${sub < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                   {sub > 0 ? '▲' : sub < 0 ? '▼' : ''}
                 </span>
               )}
          </div>
        </div>
      </div>
    </div>
  );
});

interface HUDProps {
  resources: GameState['resources'];
  financials: { net: number };
  population: number;
}

export const HUD: React.FC<HUDProps> = React.memo(({ resources, financials, population }) => {
  return (
    <div className="absolute top-0 left-0 right-0 p-2 sm:p-3 pt-3 sm:pt-4 z-10 flex flex-nowrap overflow-x-auto no-scrollbar gap-2 sm:gap-3 pointer-events-none items-start justify-start sm:justify-center px-3 sm:px-4">
       <ResourceBlock 
         icon={Coins} 
         val={resources.agt} 
         label="AGT" 
         borderClass="border-amber-600/80" 
         iconBgClass="bg-amber-500" 
         sub={financials.net} 
       />
       <ResourceBlock 
         icon={Pickaxe} 
         val={resources.minerals} 
         label="Ore" 
         borderClass="border-slate-500/80" 
         iconBgClass="bg-slate-400" 
       />
       <ResourceBlock 
         icon={Leaf} 
         val={resources.eco} 
         label="Eco" 
         borderClass="border-emerald-600/80" 
         iconBgClass="bg-emerald-500" 
       />
       <ResourceBlock 
         icon={Heart} 
         val={resources.trust} 
         label="Trust" 
         borderClass="border-rose-600/80" 
         iconBgClass="bg-rose-500" 
       />
       <ResourceBlock 
         icon={Users} 
         val={population} 
         label="Pop" 
         borderClass="border-blue-600/80" 
         iconBgClass="bg-blue-500"
       />
       <ResourceBlock 
         icon={Gem} 
         val={resources.gems} 
         label="Gems" 
         borderClass="border-purple-600/80" 
         iconBgClass="bg-purple-500"
         textColor="text-purple-300"
       />
    </div>
  );
});
