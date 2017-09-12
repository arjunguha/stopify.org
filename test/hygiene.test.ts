import * as helpers from '../src/common/helpers';
import * as babel from 'babel-core';
import { NodePath, Visitor } from 'babel-traverse';
import * as t from 'babel-types';
import Hygiene from '../src/common/hygiene';
import * as fastFreshId from '../src/fastFreshId';

const assert = require('assert');

interface Args {
  reserved: Set<string>
}

const visitor = {
  BindingIdentifier({ node: { name } }: NodePath<t.Identifier>,
                    { reserved }: Args) {
    if (reserved.has(name)) {
      assert.fail(`${name} was not renamed`);
    }
  },
  ReferencedIdentifier({ node: { name } }: NodePath<t.Identifier>,
                    { reserved }: Args) {
    if (reserved.has(name)) {
      assert.fail(`${name} was not renamed`);
    }
  }
};

const initVisitor = {
  Program(path: NodePath<t.Program>) {
    fastFreshId.init(path)
  }
}

let is_init = false

function check(src: string, ...reserved: string[]) {
  if (is_init === false) {
    let { ast: init_ast } = babel.transform(src, {
      babelrc: false,
      plugins: []
    });

    babel.traverse(init_ast!, initVisitor, undefined)

    is_init = true
  }

  const { ast } = babel.transform(src, {
    babelrc: false,
    plugins: [ [ Hygiene, { reserved } ] ]
  });

  const state = {
    reserved: new Set(reserved)
  };

  babel.traverse(ast!, visitor, undefined, state);
}

describe("Testing hygiene visitor", function() {
  it("function argument", () => {
    check(`function f(target, x) { return target; }`, "target");
  });

  it("function name", () => {
    check(`function f(x) { return f; }`, "f");
  });

  it("local bound variable", () => {
    check(`function g(x) { var f; return f; }`, "f");
  });

});
