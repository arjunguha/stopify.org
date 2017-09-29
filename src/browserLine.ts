import * as path from 'path';
import { parseRuntimeOpts } from './cli-parse';

export function localBenchmarkUrl(args: string[]) {
  const ret = 'file://' + path.resolve(__dirname, '../../dist/benchmark.html') +
    '#' + encodeArgs(args);
  return ret;
}

export function benchmarkUrl(args: string[]) {
  const opts = parseRuntimeOpts(args);
  opts.filename = path.basename(opts.filename);
  console.log(`To run locally: ${localBenchmarkUrl(args)}`);
  return encodeURIComponent(JSON.stringify(opts)); 
}

export function encodeArgs(args: string[]) {
  const opts = parseRuntimeOpts(args);
  opts.filename = path.resolve('.', opts.filename);
  return encodeURIComponent(JSON.stringify(opts));
}

if (require.main === module) {
  const args = process.argv.slice(2);
  console.log(localBenchmarkUrl(args));
}
