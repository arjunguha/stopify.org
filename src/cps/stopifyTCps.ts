import {stopifyFunction, stopifyPrint} from '../interfaces/stopifyInterface';

// Desugaring transforms.
const noArrows = require('babel-plugin-transform-es2015-arrow-functions');
import * as desugarLoop from '../common/desugarLoop';
import * as desugarFunctionDecl from '../common/desugarFunctionDecl';
import * as desugarNew from '../common/desugarNew';
import * as desugarSwitch from '../common/desugarSwitch';
import * as desugarWhileToFunc from '../common/desugarLoopToFunc';
import * as desugarLabel from '../common/desugarLabel';
import * as trampolineApply from './trampolineApply';
import * as liftVar from '../common/liftVar';

// Call Expression naming transform.
import * as makeBlockStmt from '../common/makeBlockStmt';

// CPS transforms.
import * as addKArg from './addContinuationArg';
import * as cps from './cpsSyntax';
import * as applyStop from './stoppableApply';

import * as transformMarked from '../common/transformMarked';

// Helpers
import {transform} from '../common/helpers';

const cpsRuntime = `"use strict";

let $counter = 0;
function $mark_func(f) {
  f.$isTransformed = true;
  f.call = f.call.bind(f);
  f.call.$isTransformed = true;
  f.apply = f.apply.bind(f);
  f.apply.$isTransformed = true;
  Object.defineProperty(f, "length", {
    configurable: true,
    value: f.length - 2
  });
  return f;
}

function $runTrampolined(f) {
  while(f && f.tramp) {
    if($counter-- <= 0) {
      $counter = $interval
      setTimeout(_ => {
        if($isStop()) {
          $onStop();
        } else {
          return $runTrampolined(f)
        }
      }, 0)
      break;
    } else {
      f = f.f()
    }
  }
}

function $onError(arg) {
  throw new Error('Unexpected error: ' + arg);
}

function applyWithK(f, k, ek, ...args) {
  if (f.$isTransformed) return f(k, ek, ...args);else try {
    return k(f(...args));
  } catch (e) {
    return ek(e);
  }
}

function call_applyWithK(f, k, ek, ...args) {
  const [hd, ...tail] = args;
  if (f.$isTransformed) return f.call(hd, k, ek, ...tail);else try {
    return k(f.call(hd, ...tail));
  } catch (e) {
    return ek(e);
  }
}

function apply_applyWithK(f, k, ek, thisArg, args) {
  if (f.$isTransformed) return f.apply(thisArg, [k, ek, ...args]);else try {
    return k(f.apply(thisArg, args));
  } catch (e) {
    return ek(e);
  }
}

function apply_helper(how) {
  return function (f, k, ek, ...args) {
    if ($counter-- === 0) {
      $counter = $interval;
      setTimeout(_ => {
        if ($isStop()) $onStop();else return how(f, k, ek, ...args);
      }, 0);
    } else return how(f, k, ek, ...args);
  };
}

const admin_apply = apply_helper(function (f, ...args) {
  return f(...args);
});
const apply = apply_helper(function (f, k, ek, ...args) {
  return applyWithK(f, k, ek, ...args);
});
const call_apply = apply_helper(function (f, k, ek, ...args) {
  return call_applyWithK(f, k, ek, ...args);
});
const apply_apply = apply_helper(function (f, k, ek, thisArg, args) {
  return apply_applyWithK(f, k, ek, thisArg, args);
});

`;

export const tcpsStopifyPrint: stopifyPrint = (code: string, opts) => {
  const plugins = [
    [desugarFunctionDecl, liftVar, noArrows, desugarLoop, desugarLabel,
      desugarNew],
    [desugarSwitch, addKArg, desugarWhileToFunc],
    [makeBlockStmt],
    [cps, applyStop, trampolineApply, transformMarked],
  ];

  const transformed: string = transform(code, plugins, opts).code;

  if(transformed.length < code.length) {
    throw new Error('Transformed code is smaller than original code')
  }

  return `
function $stopifiedProg($isStop, $onStop, $onDone, $interval) {
${cpsRuntime}
${transformed}
}
  `
}

export const tcpsStopify: stopifyFunction = (code, opts) => {
  return eval(`
(function() {
  return (${tcpsStopifyPrint(code, opts)})
})()
    `)
}
