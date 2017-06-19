import {NodePath, VisitNode, Visitor} from 'babel-traverse';
import * as t from 'babel-types';
import {letExpression} from '../common/helpers';

const functionDecl: Visitor = {
  FunctionDeclaration: function (path: NodePath<t.FunctionDeclaration>) {
    const { id, params, body } = path.node;
    path.replaceWith(letExpression(id,
      t.functionExpression(id, params, body), 'var'));
  }
};

module.exports = function() {
  return { visitor: functionDecl };
};
