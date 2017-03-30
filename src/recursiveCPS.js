/**
 * Module to CPS a simplified javascript AST.
 */

const t = require('babel-types');
const h = require('./helpers.js');

const visitor = {};
function flatten(seq) {
  return seq.reduce((prog, statements) => prog.concat(statements), []);
}

function stratifyExpression(e, k, path) {
  if (t.isIdentifier(e)) {
    return [k(e), []];
  } else if (t.isNumericLiteral(e)) {
    return [k(e), []];
  } else if (t.isBooleanLiteral(e)) {
    return [k(e), []];
  } else if (t.isBinaryExpression(e)) {
    let pres = [];
    const [exp, presLeft] = stratifyExpression(e.left,
        (leftResult) => {
          const [expRight, presRight] = stratifyExpression(e.right,
                rightResult => k(t.binaryExpression(e.operator,
                    leftResult,
                    rightResult)), path);
          pres = pres.concat(presRight);
          return expRight;
        }, path);
    return [exp, pres.concat(presLeft)];
  } else if (t.isLogicalExpression(e)) {
    let pres = [];
    const [exp, presLeft] = stratifyExpression(e.left,
        (leftResult) => {
          const [expRight, presRight] = stratifyExpression(e.right,
                rightResult => k(t.logicalExpression(e.operator,
                    leftResult,
                    rightResult)), path);
          pres = pres.concat(presRight);
          return expRight;
        }, path);
    return [exp, pres.concat(presLeft)];
  } else if (t.isFunctionExpression(e)) {
    const body = stratifyStatement(e.body, x => x, path);
    return [k(t.functionExpression(e.id, e.params,
        t.blockStatement(body))), []];
  } else if (t.isCallExpression(e)) {
    let pres = [];
    const [exp, presCallee] = stratifyExpression(e.callee,
        (func) => {
          const tmp = path.scope.generateUidIdentifier('r');
          const presArgs = [];
          const args = e.arguments.map((arg) => {
            const [expArg, pre] = stratifyExpression(arg, x => x, path);
            pres = presArgs.concat(pre);
            return expArg;
          });
          const c = t.callExpression(func, args);
          const v = h.letExpression(tmp, c);
          pres = pres.concat(presArgs);
          pres = pres.concat(v);
          return k(tmp);
        }, path);
    return [exp, pres.concat(presCallee)];
  }

  return [k(e), []];
}

function stratifyStatement(statement, k, path) {
  if (t.isExpressionStatement(statement)) {
    const [exp, pres] = stratifyExpression(statement.expression, k, path);
    return pres.concat([t.expressionStatement(exp)]);
  } else if (t.isBlockStatement(statement)) {
    return [t.blockStatement(flatten(statement.body.map(x => stratifyStatement(x, k, path))))];
  } else if (t.isReturnStatement(statement)) {
    const [exp, pres] = stratifyExpression(statement.argument, k, path);
    return pres.concat([t.returnStatement(exp)]);
  } else if (t.isVariableDeclaration(statement)) {
    let pres = [];
    return pres.concat([t.variableDeclaration(statement.kind,
        statement.declarations.map((decl) => {
          const [exp, pre] = stratifyExpression(decl.init, k, path);
          pres = pres.concat(pre);
          return t.variableDeclarator(decl.id, exp);
        }))]);
  }

  return [statement];
}

visitor.Program = function (path) {
  const node = path.node;
  const { body } = node;

  function mapStratify(s) {
    return stratifyStatement(s, x => x, path);
  }

  const stratifyBody = flatten(body.map(mapStratify));
  node.body = stratifyBody;
};

module.exports = function transform(babel) {
  return { visitor };
};
