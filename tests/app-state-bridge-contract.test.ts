import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appSource = readFileSync('App.tsx', 'utf8');
const engineHookSource = readFileSync('game/useAureusEngine.ts', 'utf8');

test('App consumes state from useAureusEngine only', () => {
    assert.match(appSource, /import \{ useAureusEngine \} from '\.\/game\/useAureusEngine';/);
    assert.doesNotMatch(appSource, /useEngineState/);
    assert.match(appSource, /const \{ world, state, dispatch, getDebugStats, loading \} = useAureusEngine\(/);
    assert.match(appSource, /stateRef\.current = state;/);
});

test('useAureusEngine remains the React state subscription owner', () => {
    assert.match(engineHookSource, /state: GameState \| null;/);
    assert.match(engineHookSource, /const \[state, setState\] = useState<GameState \| null>\(null\);/);
    assert.match(engineHookSource, /worldInstance\.subscribeToState\(\(newState\) => \{\s*setState\(newState\);\s*\}\);/s);
    assert.match(engineHookSource, /state,\s*loading,/);
});
