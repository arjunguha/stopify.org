/**
 * Plugin to transform JS programs into ANF form.
 *
 * WARNING:
 * The plugin assumes that the assumptions stated in ./src/desugarLoop.js
 * hold. The resulting output is not guarenteed to be in ANF form if the
 * assumptions do not hold.
 */

import {NodePath, VisitNode, Visitor} from 'babel-traverse';
import * as t from 'babel-types';
import * as h from './helpers';

// Consequents and alternatives in if statements must always be blocked,
// otherwise variable declaration get pulled outside the branch.
const ifStatement : VisitNode<t.IfStatement> = function (path: NodePath<t.IfStatement>): void {
  const { consequent, alternate } = path.node;

  if (t.isBlockStatement(consequent) === false) {
    path.node.consequent = t.blockStatement([consequent]);
  }

  if (alternate !== null && t.isBlockStatement(alternate) === false) {
    path.node.alternate = t.blockStatement([alternate]);
  }

  // Make sure if has an else branch.
  if (alternate === null) {
    path.node.alternate = t.blockStatement([t.emptyStatement()]);
  }
};

const loop: VisitNode<t.Loop> = function (path: NodePath<t.Loop>): void {
  if(t.isBlockStatement(path.node.body)) return;
  path.node.body = t.blockStatement([path.node.body])
}

const funcExpr: VisitNode<t.FunctionExpression> =
  function (path: NodePath<t.FunctionExpression>): void {
  const p = path.parent;

  if (!t.isVariableDeclarator(p)) {
    // Name the function expression if it is not already named.
    const name = path.scope.generateUidIdentifier('funcExpr');
    const bind = h.letExpression(name, path.node);
    path.getStatementParent().insertBefore(bind);
    path.replaceWith(name);
  }
}

const anfVisitor : Visitor = {
  IfStatement: ifStatement,
  "Loop": loop,
  FunctionExpression: funcExpr,
}

module.exports = function() {
  return { visitor: anfVisitor };
};
