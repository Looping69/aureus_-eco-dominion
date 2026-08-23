import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const agentHud = readFileSync('components/AgentCommandHUD.tsx', 'utf8');
const app = readFileSync('App.tsx', 'utf8');

test('agent command HUD exposes selected combat command feedback', () => {
    assert.match(agentHud, /interface AgentCommandHUDProps/);
    assert.match(agentHud, /selectedAgentId: string \| null/);
    assert.match(agentHud, /selectedAgentIds\?: string\[\]/);
    assert.match(agentHud, /const selectedIds = selectedAgentIds\.length > 0 \? selectedAgentIds : selectedAgentId \? \[selectedAgentId\] : \[\];/);
    assert.match(agentHud, /if \(selectedIds\.length === 0\) return null;/);
    assert.match(agentHud, /if \(selectedAgents\.length === 0\) return null;/);
    assert.match(agentHud, /Command Link/);
    assert.match(agentHud, /Weapon/);
    assert.match(agentHud, /Order/);
    assert.match(agentHud, /HP/);
});

test('agent command HUD summarizes single and grouped selections', () => {
    assert.match(agentHud, /const groupLabel = selectedAgents\.length > 1 \? `\$\{selectedAgents\.length\} selected` : leadAgent\.name;/);
    assert.match(agentHud, /const stanceSet = new Set\(selectedAgents\.map\(getCombatStanceLabel\)\);/);
    assert.match(agentHud, /const orderStateLabel = stanceSet\.size === 1 \? getCombatStanceLabel\(leadAgent\) : 'MIXED';/);
    assert.match(agentHud, /const readyAgents = selectedAgents\.filter\(\(agent\) => agent\.combat && agent\.combat\.currentHealth > 0\)\.length;/);
    assert.match(agentHud, /const armedAgents = selectedAgents\.filter\(\(agent\) => getWeaponLabel\(agent\) !== 'Unarmed'\)\.length;/);
    assert.match(agentHud, /selectedAgents\.length > 1 \? <Users size=\{16\} \/> : <Target size=\{16\} \/>/);
});

test('agent command HUD shows compact order tone state', () => {
    assert.match(agentHud, /const ORDER_TONE_CLASS: Record<string, string> = \{/);
    for (const stance of ['AGGRESSIVE', 'HOLD', 'ATTACK', 'AUTO', 'MIXED']) {
        assert.match(agentHud, new RegExp(`${stance}:`));
    }
    assert.match(agentHud, /const orderToneClass = ORDER_TONE_CLASS\[orderStateLabel\] \?\? ORDER_TONE_CLASS\.AUTO;/);
    assert.match(agentHud, /\$\{orderToneClass\}`}>\s*\{orderStateLabel\}/);
    assert.match(agentHud, /orderStateLabel === 'MIXED' \? `\$\{stanceSet\.size\} stances` : orderStateLabel/);
});

test('App renders agent command HUD with floating HUD visibility', () => {
    assert.match(app, /import \{ AgentCommandHUD \} from '\.\/components\/AgentCommandHUD';/);
    assert.match(app, /<AgentCommandHUD agents=\{state\.agents\} selectedAgentId=\{state\.selectedAgentId\} selectedAgentIds=\{state\.selectedAgentIds\} \/>/);
    assert.ok(app.indexOf('<AgentCommandHUD') > app.indexOf('{floatingHudVisible && ('));
    assert.ok(app.indexOf('<AgentCommandHUD') < app.indexOf('<CommandFailureToast'));
});
