import * as common from './runtime';
export * from './runtime';

export let stack: common.Stack = [];
export let mode: common.Mode = 'normal';

/**
 * Applies f to the current continuation in the empty context.
 *
 * Semantics: E[captureCC(f)] --> f((v) => abortCC(E[v]))
 *
 * WARNING: It is not possible to define callCC using captureCC. The obvious
 * approach breaks the semantics of exceptions.
 */
export function captureCC(f: (k: any) => any): void {
  throw new common.Capture(f, []);
}

/**
 * discards the current continuation and then applies f.
 */
export function abortCC(f: () => any) {
  throw new common.Discard(f);
}

export function makeCont(stack: common.Stack) {
  return function (v: any) {
    throw new common.Restore([topK(() => v), ...stack]);
  }
}

// Helper function that constructs a top-of-stack frame.
export function topK(f: () => any): common.KFrameTop {
  return {
    kind: 'top',
    f: () => {
      stack = [];
      mode = 'normal';
      return f();
    }
  };
}

export function suspendCC(f: (k: any) => any): any {
  return captureCC((k) => {
    return f(function (x: any) {
      return setTimeout(() => runtime(() => k(x)), 0);
    });
  });
}

export function runtime(body: () => any): any {
  try {
    body();
  }
  catch (exn) {
    if (exn instanceof common.Capture) {
      // Recursive call to runtime addresses nested continuations. The return
      // statement ensures that the invocation is in tail position.
      // At this point, exn.stack is the continuation of callCC, but doesn’t have
      // a top-of-stack frame that actually restores the saved continuation. We
      // need to apply the function passed to callCC to the stack here, because
      // this is the only point where the whole stack is ready.
      // Doing exn.f makes "this" wrong.
      return runtime(() => exn.f.call(global, makeCont(exn.stack)));
    } else if (exn instanceof common.Discard) {
      return runtime(() => exn.f());
    } else if (exn instanceof common.Restore) {
      // The current continuation has been discarded and we now restore the
      // continuation in exn.
      return runtime(() => {
        if (exn.stack.length === 0) {
          throw new Error(`Can't restore from empty stack`);
        }
        mode = 'restoring';
        stack = exn.stack;
        stack[stack.length - 1].f();
      });
    } else {
      throw exn; // userland exception
    }
  }
}

export const knownBuiltIns = [Object, Function, Boolean, Symbol, Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, Number, Math, Date, String, RegExp, Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, Map, Set, WeakMap, WeakSet];

export function handleNew(constr: any, ...args: any[]) {
  if (knownBuiltIns.includes(constr)) {
    return new constr(...args);
  }

  let obj;
  if (mode === "normal") {
    obj = Object.create(constr.prototype);
  } else {
    const frame = stack[stack.length - 1];
    if (frame.kind === "rest") {
      [obj] = frame.locals;
    } else {
      throw "bad";
    }
    stack.pop();
  }

  try {
    if (mode === "normal") {
      constr.apply(obj, args);
    }
    else {
      stack[stack.length - 1].f.apply(obj, []);
    }
  }
  catch (exn) {
    if (exn instanceof common.Capture) {
      exn.stack.push({
        kind: "rest",
        f: () => handleNew(constr, ...args) ,
        locals: [obj],
        index: 0
      });
    }
    throw exn;
  }
  return obj;
}

let countDown: number | undefined;

export function resume(result: any) {
  return setTimeout(() => runtime(result), 0);
}

export function suspend(interval: number, top: any) {
  if (Number.isNaN(interval)) {
    return;
  }
  if (countDown === undefined) {
    countDown = interval;
  }
  if (--countDown === 0) {
    countDown = interval;
    return captureCC(top);
  }
}

