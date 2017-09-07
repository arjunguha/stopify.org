import * as babel from 'babel-core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import * as tmp from 'tmp';
const glob = require('glob');

export const unitTests = glob.sync('test/should-run/*.js', {})
export const intTests = glob.sync('test/should-run/source-language/*.js', {})
export const stopTests = glob.sync('test/should-stop/*.js', {})

export function callCCTest(srcPath: string, transform: string) {
  const testName = `${srcPath} (${transform})`;

  // Skip tests we know we can't handle
  if (path.basename(srcPath).indexOf("eval") === 0) {
    it.skip(testName);
    return;
  }

  it(testName, () => {
    const basename = path.basename(srcPath, '.js')
    const { name: dstPath } = tmp.fileSync({ dir: ".", postfix: `${basename}.js` });
    execSync(`./bin/compile --transform ${transform} ${srcPath} ${dstPath}`);
    try {
      execSync(`./bin/run ${dstPath} --yield 1`, { timeout: 30000 });
    }
    finally {
      // NOTE(arjun): I wouldn't mind if these were always left around.
      fs.unlinkSync(dstPath);
    }
  });
}

export function browserTest(srcPath: string, transform: string) {
  const testName = `${srcPath} (${transform}) (in-browser)`;

  // Skip tests we know we can't handle
  if ( srcPath.indexOf("dart") >= 0 ||
      srcPath.indexOf("ocaml") >= 0) {
    it.skip(testName);
    return;
  }

  it(testName, () => {
    const { name: dstPath } = tmp.fileSync({ dir: ".", postfix: ".js" });
    const { name: htmlPath } = tmp.fileSync({ dir: ".", postfix: ".html" });
    execSync(`./bin/compile --transform ${transform} ${srcPath} ${dstPath}`);
    execSync(`./bin/webpack ${dstPath} ${htmlPath}`);
    execSync(`./bin/browser ${htmlPath} --yield 1000 --env chrome`);
    execSync(`./bin/browser ${htmlPath} --yield 1000 --env firefox`);
    fs.unlinkSync(dstPath);
    fs.unlinkSync(htmlPath);
  });
}

export function stopCallCCTest(srcPath: string, transform: string) {
  const testName = `${srcPath} (${transform}) (infinite loop)`;

  // Don't even try this on a non-Linux platform!
  if (os.platform() !== 'linux') {
    it.skip(testName);
    return;
  }

  // Skip tests that we know we can't handle
  if (srcPath.indexOf("eval") >= 0) {
    it.skip(testName);
    return;
  }
  it(testName, () => {
    const { name: dstPath } = tmp.fileSync({ dir: ".", postfix: ".js" });
    execSync(`./bin/compile --transform ${transform} ${srcPath} ${dstPath}`);
    try {
      execSync(`./bin/run ${dstPath} --yield 10 --stop 1`, { timeout: 5000 });
    }
    finally {
      // NOTE(arjun): I wouldn't mind if these were always left around.
      fs.unlinkSync(dstPath);
    }
  });
}
