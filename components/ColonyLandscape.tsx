import React from 'react';

/** Small authored isometric landscape matching Aureus's tile-built world. */
export function ColonyLandscape() {
    const point = (x:number,z:number) => ({x:330+(x-z)*31,y:110+(x+z)*16});
    const tiles = [];
    const trees = [];
    for(let z=0;z<7;z++) for(let x=0;x<9;x++) {
        if((x===0&&z<2)||(x===8&&z>4)) continue;
        const p=point(x,z);
        const river=x===1||x===2;
        const road=!river&&(x===4||z===3);
        const color=river ? ['#397d88','#458e94'][(x+z)%2] : road ? '#bcaf7c' : ['#628650','#78955b','#587b4c'][(x+z)%3];
        tiles.push(<g key={`${x}-${z}`}><path d={`M${p.x-31},${p.y+16} l31,16 31,-16 v27 l-31,16 -31,-16Z`} fill={(x+z)%2?'#4b5140':'#615c43'}/><path d={`M${p.x},${p.y} l31,16 -31,16 -31,-16Z`} fill={color} stroke="#102c24" strokeOpacity=".13"/>{river&&<path d={`M${p.x-12},${p.y+16} l17,7 m-6,-15 13,6`} stroke="#a4d4cc" strokeWidth="1.5" opacity=".45"/>}</g>);
        if(!river&&!road&&(x*7+z*5)%9<3) trees.push(<g key={`t${x}-${z}`} transform={`translate(${p.x},${p.y+14})`}><ellipse cy="4" rx="16" ry="7" fill="#13392e" opacity=".35"/><path d="M-3,-13 h6 v18 h-6Z" fill="#806344"/><path d="M0,-53 19,-13 0,-6 -19,-13Z" fill="#285a41"/><path d="M0,-53 0,-6 -19,-13Z" fill="#347250"/><path d="M0,-69 14,-34 0,-29 -14,-34Z" fill="#447c50"/></g>);
    }
    const house=(x:number,z:number,key:string,roof:string) => {const p=point(x,z);return <g key={key} transform={`translate(${p.x},${p.y+10})`}><ellipse cy="15" rx="35" ry="15" fill="#14362c" opacity=".3"/><path d="M-24,-12 0,0 24,-12 V16 L0,29 -24,16Z" fill="#dfdbba"/><path d="M0,0 24,-12 V16 L0,29Z" fill="#a8ac8a"/><path d="M-29,-15 -5,-40 29,-14 0,3Z" fill={roof}/><path d="M-29,-15 -5,-40 -2,-22 0,3Z" fill="#e4ba75" opacity=".4"/><path d="M-15,1 -7,5 V15 L-15,11Z M6,6 16,1 V10 L6,15Z" fill="#41655c"/><path d="M-2,14 4,11 V26 L-2,29Z" fill="#756149"/></g>};
    const solar=point(6,5), tower=point(7,1);
    return <svg viewBox="0 0 720 470" role="img" aria-labelledby="colony-landscape-title" className="colony-landscape">
        <title id="colony-landscape-title">An isometric colony with a river, woodland, homes, a mine and solar panels</title>
        <defs><radialGradient id="colony-glow"><stop stopColor="#d8b36b" stopOpacity=".18"/><stop offset="1" stopColor="#d8b36b" stopOpacity="0"/></radialGradient></defs>
        <ellipse cx="368" cy="234" rx="310" ry="208" fill="url(#colony-glow)"/>
        <g fill="none" stroke="#acc3a1" opacity=".13"><ellipse cx="367" cy="292" rx="294" ry="141"/><ellipse cx="367" cy="292" rx="315" ry="158"/><path d="M70 292h35m524 0h30M367 120v-25m0 340v23"/></g>
        <ellipse cx="365" cy="337" rx="224" ry="65" fill="#031e19" opacity=".5"/>
        {tiles}
        {trees}
        {house(3,2,'home','#ae7250')}{house(5,3,'hall','#426b58')}{house(6,2,'store','#a7764c')}
        <g transform={`translate(${solar.x},${solar.y})`}><path d="M-22 12v18m44 -16v18" stroke="#a8bcb0" strokeWidth="4"/><path d="M0,-4 36,15 0,34 -36,15Z" fill="#285867" stroke="#abc9ba" strokeWidth="2"/><path d="M-18,5 18,24m-36 0 36,-19M0,-4V34M-36,15H36" stroke="#82b6ad" strokeWidth="1"/></g>
        <g transform={`translate(${tower.x},${tower.y})`}><path d="M-16,10 0,-70 16,10M-11,-15h22M-6,-40H6" fill="none" stroke="#d7ac5b" strokeWidth="5"/><path d="M0,-70 43,-54v34" fill="none" stroke="#d7ac5b" strokeWidth="4"/><path d="M34,-20 51,-11 40,-5 26,-12Z" fill="#647163"/><path d="M-20,8 0,-3 22,9 0,22Z" fill="#37443b"/></g>
        <g fill="#e9c67f"><circle cx="437" cy="231" r="3"/><circle cx="368" cy="264" r="3"/><circle cx="399" cy="280" r="3"/></g>
    </svg>;
}
