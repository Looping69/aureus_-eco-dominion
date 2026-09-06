import assert from 'node:assert/strict';
import ts from 'typescript';

/** Extract one action branch without consuming sibling branches or nested braces. */
export function getActionBranch(source: string, actionType: string): string {
  const file = ts.createSourceFile('action-source.ts', source, ts.ScriptTarget.Latest, true);
  const branches: ts.Statement[] = [];

  function visit(node: ts.Node): void {
    if (ts.isIfStatement(node)) {
      const condition = node.expression;
      if (
        ts.isBinaryExpression(condition)
        && condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        && ts.isPropertyAccessExpression(condition.left)
        && ts.isIdentifier(condition.left.expression)
        && condition.left.expression.text === 'action'
        && condition.left.name.text === 'type'
        && ts.isStringLiteral(condition.right)
        && condition.right.text === actionType
      ) {
        branches.push(node.thenStatement);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  assert.equal(branches.length, 1, `Expected exactly one ${actionType} action branch`);
  return branches[0].getText(file);
}
