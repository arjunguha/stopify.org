import * as React from "react";
import { render } from 'react-dom';
import { StopifyAce } from './StopifyAce';
import * as browser from 'detect-browser';
import { langs } from './languages';

import { AsyncRun, CompilerOpts, RuntimeOpts } from 'stopify';

declare const stopify : any;



const consoleFeed = require('console-feed');
const Console = require('console-feed').Console;

type Mode = 'stopped' | 'paused' | 'compiling' | 'running';

type StopifyComponentProps = {
  runner: AsyncRun,
  callback: (mode: Mode) => void
};

class StopifyComponent extends React.Component<StopifyComponentProps, { logs: any[] }> {

  constructor(props: StopifyComponentProps) {
    super(props);
    this.state = { logs: [] };
    this.props.callback('running');
  }

  componentDidMount() {
    console.log('componentDidMount');
    // this.props.runner.g.console = { };
    this.props.runner.g.console = {
      log: (msg: any) => {
        this.setState((prevState) => ({logs: [...prevState.logs, {
          method: 'log',
          data: [msg]
        }]}))
      },
    };;
    window.setTimeout(() =>
      this.props.runner.run((result) => {
      }), 0);
  }

  render() {
    return <div style={{ backgroundColor: '#242424', height: "100%" }} >
      <Console logs={this.state.logs}></Console>
    </div>
  }

}

class MultilingualStopifyEditor extends React.Component<{}, {language: string}> {

  constructor(props: { language: string }) {
    super(props);
    let lang = 'JavaScript';
    if (window.location.hash.length > 1 &&
        Object.keys(langs).includes(window.location.hash.slice(1))) {
        lang = window.location.hash.slice(1);
    }
    this.state = {
      language: lang
    };
  }

  updateState(event: React.ChangeEvent<HTMLSelectElement>) {
    this.setState({ language: event.target.value });
  }

  render() {
    return [
      <div key="chooseLang" className="row">
        <div className="col-md-12">
          <span className="dropdown">
            <button className="btn btn-default dropdown-toggle" type="button" data-toggle="dropdown">
              {this.state.language}
              <span className="caret"></span>
            </button>
            <ul className="dropdown-menu">
            <li><a href="#" onClick={() => this.setState({ language: 'JavaScript' })}>JavaScript</a></li>
              <li><a href="#" onClick={() => this.setState({ language: 'Dart' })}>Dart</a></li>
              <li><a href="#" onClick={() => this.setState({ language: 'Python' })}>Python</a></li>
              <li><a href="#" onClick={() => this.setState({ language: 'Scala' })}>Scala</a></li>
              <li><a href="#" onClick={() => this.setState({ language: 'OCaml' })}>OCaml</a></li>
              <li><a href="#" onClick={() => this.setState({ language: 'C++' })}>C++</a></li>
              <li><a href="#" onClick={() => this.setState({ language: 'Clojure' })}>Clojure</a></li>
            </ul>
          </span>
        </div>
        <div className="col-md-3"></div>
      </div>,
      <StopifyEditor key="editor" language={this.state.language}></StopifyEditor>
    ];
  }
}

interface StopifyEditorState {
  language: string,
  mode: Mode,
  program: string,
  breakpoints: number[],
  line: number | null,
  rhs: { type: 'runner', runner: AsyncRun } |
       { type: 'message', text: string }
}

class StopifyEditor extends React.Component<{ language: string }, StopifyEditorState> {

  static compileMessage = 'Click "Run" to compile and run.';

  constructor(props: { language: string }) {
    super(props);
    // editor.getSession().setMode(langs[props.language].aceMode);
    // if (lastLineMarker !== null) {
    //   editor.session.removeMarker(lastLineMarker);
    // }
    this.state = {
      language: props.language,
      mode: 'stopped',
      program: langs[props.language].defaultCode,
      breakpoints: [],
      line: null,
      rhs: { type: 'message', text: StopifyEditor.compileMessage }
    };
  }

  stopifyCallback(mode: Mode) {
    // window.addEventListener('message', evt => {
    //   // Message could be from somethign else, e.g., React DevTools
    //   if (this.iframe === null || evt.source !== this.iframe.contentWindow) {
    //     return;
    //   }
    //   if (evt.data.type === 'ready') {
    //     if (this.state.mode === 'compiling' &&
    //         this.state.rhs.type === 'iframe') {
    //       this.setState({ mode: 'running' });
    //       this.iframe!.contentWindow.postMessage({
    //         type: 'start',
    //         path: this.state.rhs.path,
    //         opts: this.state.rhs.opts,
    //         breakpoints: this.state.breakpoints
    //       }, '*');
    //     }
    //     else {
    //       console.warn(`Unexpected ready from container when not compiling`);
    //     }
    //   }
    //   else if (evt.data.type === 'paused') {
    //     this.setState({
    //       mode: 'paused',
    //       line: evt.data.linenum - 1 || null
    //     });
    //   }
    //   else {
    //     console.warn(`Unexpected message from container`, evt.data);
    //   }
    // });
    if (mode === 'running') {
      this.setState({ mode: 'running' });
    }
  }

  setBreakpoints(breakpoints: number[]) {
    this.setState({ breakpoints });
  }

  compile() {
    this.setState({ mode: 'compiling' });
    // if (lastLineMarker !== null) {
    //   editor.session.removeMarker(lastLineMarker);
    // }
    const runtimeOpts: Partial<RuntimeOpts> = {
      stackSize: Infinity,
      restoreFrames: Infinity,
      estimator: 'countdown',
      yieldInterval: 1,
      timePerElapsed: 1,
      resampleInterval: 1,
      variance: false,
      env: browser.name as any,
      stop: undefined
    };
    const compileOpts: Partial<CompilerOpts> = {
      debug: true,
      hofs: 'builtin'
    };
    const compileResult = stopify.stopifyLocally(this.state.program,
      compileOpts, runtimeOpts);
    if (compileResult.kind === 'error') {
      this.setState({
        mode: 'stopped',
        rhs: { type: 'message', text: compileResult.exception.toString() }
      });
      return;
    }
    this.setState({
      rhs: { type: 'runner', runner: compileResult }
    });
  }

  onPlayPause() {
    switch (this.state.mode) {
      case 'compiling':
        return; // should never happen
      case 'stopped':
        return this.compile();
      case 'running':
        this.setState({ mode: 'paused' });
        // this.iframe!.contentWindow.postMessage({ type: 'pause' }, '*');
        return;
      case 'paused':
        // this.iframe!.contentWindow.postMessage({
        //   type: 'continue',
        //   breakpoints: this.state.breakpoints
        // }, '*');
        this.setState({ mode: 'running' });
        return;
    }
  }

  onStep() {
    if (this.state.mode !== 'paused') {
      return;
    }
    // this.iframe!.contentWindow.postMessage({ type: 'step' }, '*');
  }

  onStop() {
    this.setState({
      mode: 'stopped',
      rhs: { type: 'message', text: StopifyEditor.compileMessage },
      line: null
    });
  }

  componentWillReceiveProps(nextProps: { language: string }) {
    // When the language changes, we stop the program and clear the output
    // and breakpoints.
    this.setState({
      mode: 'stopped',
      rhs: { type: 'message', text: StopifyEditor.compileMessage },
      breakpoints: []
    });
    if (this.props.language !== nextProps.language) {
      this.setState({ program: langs[nextProps.language].defaultCode });
    }
  }

  // componentWillUpdate(nextProps: { language: string }, nextState: StopifyEditorState) {
  //   if (this.props.language !=== this.props.language) {

  //   if (this.state.mode !===
  // }

  shouldComponentUpdate(nextProps: { language: string }, nextState: StopifyEditorState): boolean {
    return (
      this.state.mode !== nextState.mode ||
      this.state.line !== nextState.line ||
      this.state.rhs !== nextState.rhs ||
      this.props.language !== nextProps.language);
  }

  playPauseText() {
    const mode = this.state.mode;
    if (mode === 'stopped' || mode === 'paused') {
      return 'Run';
    }
    else {
      return 'Pause'
    }
  }

  stepSupported(): boolean {
    return langs[this.props.language].stepSupported;
  }

  render() {
    let rhs: JSX.Element;
    if (this.state.rhs.type === 'message') {
      const lines = this.state.rhs.text.split('\n')
        .map((line, index) => <div key={index}>{line}</div>);
      rhs = <div>{lines}</div>;
    }
    else {
     rhs = <StopifyComponent
              runner={this.state.rhs.runner}
              callback={(mode) => this.stopifyCallback(mode)}>
           </StopifyComponent>;
    }
    return <div className="row display-flex">
      <div className="col-md-8 col-xs-12">
        <div>
        <GlyphButton
          onclick={this.onPlayPause.bind(this)}
          glyph=""
          disabled={this.state.mode === 'compiling'}
          text={this.playPauseText()}
          kind="btn-primary"></GlyphButton>
        {this.stepSupported() ?
          <GlyphButton
            onclick={this.onStep.bind(this)}
            glyph=""
            disabled={this.state.mode !== 'paused'}
            text="Step"
            kind="btn-warning"></GlyphButton>
          : <div></div>}
        <GlyphButton
          onclick={this.onStop.bind(this)}
          glyph=""
          disabled={this.state.mode === 'stopped'}
          text="Stop"
          kind="btn-danger"></GlyphButton>
        </div>
        <StopifyAce line={this.state.line}
          onChange={(code) => this.setState({ program: code })}
          onBreakpoints={this.setBreakpoints.bind(this)}
          value={this.state.program}
          language={this.props.language}>
        </StopifyAce>
      </div>
      <div className="col-md-4 col-xs-12" id="output" style={{overflow: "hidden"}}>
        <div style={{height: "100%"}}>{rhs}</div>
      </div>
    </div>;
  }
}

interface GlyphButtonProps {
  onclick?: () => void,
  glyph: string,
  text: string,
  disabled: boolean,
  kind: string
}
class GlyphButton extends React.Component<GlyphButtonProps, {}> {
  constructor(props: GlyphButtonProps) {
    super(props)
  }

  render() {
    return (
      <button
         className={`${this.props.kind} btn btn-default col-md-2 ide-button`}
         type='button'
         disabled={this.props.disabled}
         onClick={() => this.props.onclick && this.props.onclick()}>
        <span className={'glyphicon ' + this.props.glyph}></span>
        {this.props.text}
      </button>);
  }
}

const o = <MultilingualStopifyEditor></MultilingualStopifyEditor>;
render(o, document.getElementById('main')!);
