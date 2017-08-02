import * as common from './runtime';

class RetValRuntime extends common.Runtime {
  constructor() {
    super();
  }

  captureCC(f: (k: any) => any): common.Capture {
    return new common.Capture(f, []);
  }

  abortCC(f: () => any) {
    return new common.Discard(f);
  }

  makeCont(stack: common.Stack): (v: any) => common.Restore {
    return (v: any) =>
      new common.Restore([this.topK(() => v), ...stack]);
  }

  runtime(body: any): any {
    if (body instanceof Function) {
      let res = body();
      if (res instanceof common.Capture) {
        // Recursive call to runtime addresses nested continuations. The return
        // statement ensures that the invocation is in tail position.
        // At this point, res.stack is the continuation of callCC, but doesn’t have
        // a top-of-stack frame that actually restores the saved continuation. We
        // need to apply the function passed to callCC to the stack here, because
        // this is the only point where the whole stack is ready.
        // Doing res.f makes "this" wrong.
        return this.runtime(() => res.f.call(global, this.makeCont(res.stack)));
      } else if (res instanceof common.Discard) {
        return this.runtime(() => res.f());
      } else if (res instanceof common.Restore) {
        // The current continuation has been discarded and we now restore the
        // continuation in res.
        return this.runtime(() => {
          if (res.stack.length === 0) {
            throw new Error(`Can't restore from empty stack`);
          }
          this.mode = 'restoring';
          this.stack = res.stack;
          return this.stack[this.stack.length - 1].f();
        });
      }
      return res;
    } else if (body instanceof common.Discard) {
      return this.runtime(() => body.f());
    } else if (body instanceof common.Restore) {
      // The current continuation has been discarded and we now restore the
      // continuation in body.
      return this.runtime(() => {
        if (body.stack.length === 0) {
          throw new Error(`Can't restore from empty stack`);
        }
        this.mode = 'restoring';
        this.stack = body.stack;
        return this.stack[this.stack.length - 1].f();
      });
    }
  }

  handleNew(constr: any, ...args: any[]) {
    if (common.knownBuiltIns.includes(constr)) {
      return new constr(...args);
    }

    let obj;
    if (this.mode === "normal") {
      obj = Object.create(constr.prototype);
    } else {
      const frame = this.stack[this.stack.length - 1];
      if (frame.kind === "rest") {
        [obj] = frame.locals;
      } else {
        throw "bad";
      }
      this.stack.pop();
    }

    if (this.mode === "normal") {
      let _a = constr.apply(obj, args);
      if (_a instanceof common.Capture) {
        _a.stack.push({
          kind: "rest",
          f: () => this.handleNew(constr, ...args) ,
          locals: [obj],
          index: 0
        });
        return _a;
      } else if (_a instanceof common.Restore) {
        return _a;
      }
    }
    else {
      let _a = this.stack[this.stack.length - 1].f.apply(obj, []);
      if (_a instanceof common.Capture) {
        _a.stack.push({
          kind: "rest",
          f: () => this.handleNew(constr, ...args) ,
          locals: [obj],
          index: 0
        });
        return _a;
      } else if (_a instanceof common.Restore) {
        return _a;
      }
    }
    return obj;
  }
}

export default new RetValRuntime();
