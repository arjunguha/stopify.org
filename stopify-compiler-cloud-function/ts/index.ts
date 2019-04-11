import * as express from 'express';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as request from 'request-promise-native';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as storage from '@google-cloud/storage';
import { resolve } from 'path';
import * as crypto from 'crypto';
import * as stopifyCompiler from 'stopify';
import { settings } from './settings';

export const stopify = express();
export const stopifyTesting = stopify;

stopify.use(cors());

const headers = { 'Content-Type': 'text/plain' };

type CacheResult = { filename: string, exists: boolean };

/**
 * Check if a compiled object is already in the cache
 * @param lang the source language
 * @param input the source program
 */
async function checkCache(lang: string, input: string): Promise<CacheResult> {
  const { outputBucket } = await settings;
  const hash = crypto.createHash('md5').update(input).digest('hex');
  const filename = `${lang}-${hash}.js`;
  const [exists] = await outputBucket.file(filename).exists();
  return { filename, exists };
}

async function runStopify(response: express.Response, jsCode: string,
  filename: string, opts: Partial<stopifyCompiler.CompilerOpts>) {
  const { outputBucket } = await settings;
  const stopifiedJsCode = stopifyCompiler.stopify(jsCode, opts);
  await outputBucket.file(filename).save(stopifiedJsCode);
  return response.send(
    `https://storage.googleapis.com/${outputBucket.name}/${filename}`);
}

function reject(response: express.Response) {
  return (reason: string) => {
    response.statusCode = 503;
    console.error(`Error: ${reason}`);
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'POST');
    response.send(reason.toString());
  };
}

// stopify.post('/js', bodyParser.text({ type: '*/*' }), (req, resp) =>
//   checkCache('js', req.body)
//   .then(({ filename,  exists }) => {
//     if (exists) {
//       resp.set('Access-Control-Allow-Origin', '*');
//       resp.set('Access-Control-Allow-Methods', 'POST');
//       return resp.send(filename);
//     }
//     else {
//       console.info(`Compiling js program (${req.body.length} bytes)`);
//       return runStopify(resp, req.body, filename, ['--debug', '--js-args=faithful', '--es=es5']);
//     }
//   })
//   .catch(reject(resp)));

function genericCompiler(lang: string, urlPath: string, opts:
  Partial<stopifyCompiler.CompilerOpts>,) {
  stopify.post(`/${lang}`, bodyParser.text({ type: '*/*' }), async (req, resp) => {
    try {
      const { thirdPartyCompilers, outputBucket } = await settings;
      const url = `${thirdPartyCompilers}/${urlPath}`;
      resp.set('Access-Control-Allow-Origin', '*');
      resp.set('Access-Control-Allow-Methods', 'POST');

      const { filename, exists } = await checkCache(lang, req.body);
      if (exists) {
        return resp.send(
          `https://storage.googleapis.com/${outputBucket.name}/${filename}`);
      }

      console.info(`Compiling ${lang} program (${req.body.length} bytes)`);
      const jsCode = await request.post(url, { headers, body: req.body });
      console.info(`Stopifying program (${jsCode.length} bytes)`);
      return await runStopify(resp, jsCode, filename, opts);
    }
    catch (exn) {
      resp.statusCode = 503;
      const reason =
        (exn.name === 'StatusCodeError' ? exn.response.body : exn).toString();
      console.error(`Error: ${reason}`);
      return resp.send(reason.toString());
    }
  });
}

genericCompiler('pyjs', `pyjs`, {
  jsArgs: 'faithful',
  externals: ['console', 'window', 'document', 'alert']
});

genericCompiler('emscripten', `emscripten`, {
  debug: true,
  externals: ['console', 'window', 'document']
});

genericCompiler('bucklescript', `bucklescript`, {
  // NOTE(arjun): setTimeout and clearTimeout appear in BS output. But, it is
  // not safe to use them in Stopify.
  externals: [ 'console', 'setTimeout', 'clearTimeout' ]
});

genericCompiler('scalajs',  `scalajs`, {
  debug: true,
});

genericCompiler('clojurescript', `clojurescript`, {
  debug: true,
  externals: ['console']
});

genericCompiler('dart2js',  `dart2js`, {
  externals: [ 'console', 'document', 'window', 'navigator' ]
});


stopify.post('/js', bodyParser.text({ type: '*/*' }), async (req, resp) => {
  try {
    resp.set('Access-Control-Allow-Origin', '*');
    resp.set('Access-Control-Allow-Methods', 'POST');

    const { thirdPartyCompilers, outputBucket } = await settings;
    const { filename, exists } = await checkCache('js', req.body);
    if (exists) {
      return resp.send(
        `https://storage.googleapis.com/${outputBucket.name}/${filename}`);
    }
    console.info(`Compiling JavaScript program (${req.body.length} bytes)`);
    const stopifiedJsCode = await stopifyCompiler.stopify(req.body, {
      debug: true,
      externals: [ 'console', 'document', 'window' ]
    });
    await outputBucket.file(filename).save(stopifiedJsCode);
    return resp.send(
      `https://storage.googleapis.com/${outputBucket.name}/${filename}`);
  }
  catch (exn) {
    resp.statusCode = 503;
    const reason =
      (exn.name === 'StatusCodeError' ? exn.response.body : exn).toString();
    console.error(`Error: ${reason}`);
    return resp.send(reason.toString());
  }
});