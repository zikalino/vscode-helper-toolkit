import * as vscode from 'vscode';
var styles: any = require("./webview/styles.html");
var stylesWorkbench: any = require("./webview/treeview-css.html");
var script: string = require("./webview/scripts.html");
var script_vscode: string = require("./webview/scripts-vscode.html");

var canvasScript: string = require("./webview/canvas-scripts.html");
var canvasSymbolsProperties: string = require("./webview/canvas-symbols-properties.html");
var canvasStyle: string = require("./webview/canvas-css.html");
var canvasHtml: string = require("./webview/canvas-html.html");
var canvasToolbarHtml: string = require("./webview/canvas-toolbar.html");
var canvasPropertiesHtml: string = require("./webview/canvas-properties.html");
var canvasRulers: string = require("./webview/canvas-rulers.html");
var canvasSelector: string = require("./webview/canvas-selector.html");

export class GenericWebView {
  constructor(extensionContext: vscode.ExtensionContext, name: string) {
    this.context = extensionContext;
    this.name = name;

    this.panel = vscode.window.createWebviewPanel(
      'displayGenericForm', // Identifies the type of the webview. Used internally
      this.name, // Title of the panel displayed to the user
      vscode.ViewColumn.One, // Editor column to show the new webview panel in.
      {
        enableScripts: true
        //localResourceRoots: [mediaFolder, vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist')]
      }
      );
  }

  public MsgHandler: (msg: any) => void = function(msg: any) {};

  private panel: vscode.WebviewPanel;

  createPanel(formDefinition: any) {

    this.processFormDefinition(formDefinition);
    
    this.formDefinition = formDefinition;
    this.panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'media',
      'espressif.svg'
    );

    const codiconsUri = this.panel.webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          'node_modules',
          '@vscode/codicons',
          'dist',
          'codicon.css'
        )
      )
      .toString();
    const uiToolkitUri = this.panel.webview
      .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview.js'))
      .toString();

    var content = this.getWebviewContentGenericForm(uiToolkitUri, codiconsUri);
  
    this.panel.webview.html = content;
    
    let populateMsg = {
      command: 'create',
      data: formDefinition,
      mediaFolder: this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media')).toString()
    };
  
    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'ready':
            this.panel.webview.postMessage(populateMsg);
            break;
          case 'select-folder':
            this.selectFolder(message.id);
            return;
          case 'button-clicked':
            this.runStepReRun(message.id);
            break;
          case 'dropdown-clicked':
            this.handleVariable(this.formDefinition, message.combo_id, message.id);
            break;
          default:
            console.log('XXX');
        }
        if (this.MsgHandler !== null) {
          this.MsgHandler(message);
        }
      },
      undefined,
      this.context.subscriptions
    );
  }
  
  public postMessage(msg: any) {
    this.panel.webview.postMessage(msg);
  }

  public close() {
    this.panel.dispose();
  }

  public showElement(id: string) {
    var def = this.findElementDefinition(this.formDefinition, id);
    if (def !== null) {
      def['hidden'] = false;
      this.postMessage({ command: 'show', id: id});
    }
  }

  public hideElement(id: string) {
    var def = this.findElementDefinition(this.formDefinition, id);
    if (def !== null) {
      def['hidden'] = true;
      this.postMessage({ command: 'hide', id: id});
    }
  }

  public disableElement(id: string) {
    this.postMessage({ command: 'disable', id: id});
  }

  public enableElement(id: string) {
    this.postMessage({ command: 'enable', id: id});
  }

  private findElementDefinition(data: any, id: string) {
    if (typeof data === 'object') {
      if (data instanceof Array) {
        for (let i of data.keys()) {
          var def: any = this.findElementDefinition(data[i], id);
          if (def !== null) {
            return def;
          }
        }
      }
      else {
        if ('id' in data && data['id'] === id) {     
          return data;
        }

        for (let key in data) {
          if (typeof data[key] === 'object' && data[key] instanceof Array) {
            var def = this.findElementDefinition(data[key], id);
            if (def !== null) {
              return def;
            }
          }
        }
      }
    }
    return null;
  }

  public setDefinition(definition: any) {
    this.postMessage({ command: 'set-definition', definition: definition});
  }

  public requestDefinition() {
    this.postMessage({ command: 'request-definition' });
  }

  private async selectFolder(id: string) {
    const workspaceFolder = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true });
    if (workspaceFolder) {
      this.postMessage({ command: 'folder-selected', id: id, folder: workspaceFolder[0].fsPath});
    }
  }

  private getWebviewContentGenericForm (uiToolkitUri: string, codiconsUri: string) {
    return `
      <head>
          <title>Generic Form</title>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />

          ${script_vscode}

          ${styles}
          ${script}
          ${stylesWorkbench}

          ${canvasStyle}
          ${canvasSymbolsProperties}
          ${canvasScript}
          ${canvasHtml}
          ${canvasToolbarHtml}
          ${canvasPropertiesHtml}
          ${canvasRulers}
          ${canvasSelector}

          <link href="${codiconsUri}" rel="stylesheet" />
  
      </head>
      <body
        onclick="onBodyClick(event);"
        role="document"
      >
        <div id='main-div' style='padding: 0px; background-color: var(--vscode-editor-background); right: 0px; top: 0px; left: 0px; bottom: 0px; position: absolute;'>
        </div>
        <script>
          vscode = acquireVsCodeApi();
          vscode.postMessage({ command: 'ready' });
        </script>
      </body>
      `;
  }

  public runStepsVerification() {
    this.actionsVerify(this.formDefinition);
  }

  public runStepsInstallation() {
    this.actionsInstall(this.formDefinition);
  }

  public runStepReRun(step_id: string) {
    this.actionReRun(this.formDefinition, step_id);
  }

  private actionsVerify(data: any) {
    try {
        
      let actionList: any[] = this.getActionList(data);

      for (let a of actionList) {
        const cp = require('child_process');
        try {
          var cmd = "";
          if (process.platform === "win32") {
            for (let v in this.variables) {
              cmd += " $" + v + "='" + this.variables[v] + "';";
            }
          } else {
            for (let v in this.variables) {
              cmd += v + "='" + this.variables[v] + "';";
            }
          }

          cmd += a['check'];
          if (process.platform === "win32") {
            cp.execSync(cmd, { shell: 'powershell' });
          } else {
            cp.execSync(cmd, { shell: '/bin/bash' });
          }
          a['status'] = 'verified';
          this.postMessage({ command: 'set-action-status', id: a['id'], status: 'verified' });
        } catch (e: any) {
          var lines = e.toString().split(/\r?\n/);
          this.terminalWriteLine("# ===========================================================");
          for (var i = 0; i < lines.length; i++) {
            this.terminalWriteLine("# " + lines[i]);
          }
          this.terminalWriteLine("# ===========================================================");

          a['status'] = 'missing';
          this.postMessage({ command: 'set-action-status', id: a['id'], status: 'failed' });
        }
      }
    } catch (e) {
      vscode.window.showInformationMessage('EXCEPTION: ' + e);
    }
  }

  private async actionsInstall(data: any) {
    try {
      let actionList: any[] = this.getActionList(data);

      for (let a of actionList) {
        if (!('status' in a) || a['status'] !== 'verified') {
          try { 
            this.postMessage({ command: 'set-action-status', id: a['id'], status: 'installing' });

            let filename = require('path').join(require("os").homedir(), Math.random().toString(36).substring(2, 15) + Math.random().toString(23).substring(2, 5));

            this.terminalWriteLine("# ===========================================================");
            this.terminalWriteLine("# ");

            if (process.platform === "win32") {
              for (let v in this.variables) {
                this.terminalWriteLine("$" + v + "='" + this.variables[v] + "'");
              }
            } else {
              for (let v in this.variables) {
                this.terminalWriteLine(v + "='" + this.variables[v] + "'");
              }
            }

            this.terminalWriteLine(a['install']);
            if (process.platform === "win32") {
              this.terminalWriteLine("$? | Out-File " + filename + " -Encoding ASCII");
            } else {
              this.terminalWriteLine("echo $? > " + filename);
            }

            while (!require('fs').existsSync(filename)) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            const data = require('fs').readFileSync(filename, 'utf8').toString();

            let verified = (process.platform === "win32") ? data.startsWith('True') : data.startsWith('0');
            if (verified) {
              a['status'] = 'verified';
              this.postMessage({ command: 'set-action-status', id: a['id'], status: 'verified' });
            } else {
              a['status'] = 'failed';
              this.postMessage({ command: 'set-action-status', id: a['id'], status: 'failed' });
            }
          } catch (e) {
            a['status'] = 'missing';
            this.postMessage({ command: 'set-action-status', id: a['id'], status: 'failed' });
          }
        }
      }
    } catch (e) {
      vscode.window.showInformationMessage('EXCEPTION: ' + e);
    }
  }

  private async actionReRun(data: any, id: string) {
    try {
        
      let actionList: any[] = this.getActionList(data);

      for (let a of actionList) {
        if (a['id'] === id) {
          try { 
            this.postMessage({ command: 'set-action-status', id: a['id'], status: 'installing' });

            let filename = require('path').join(require("os").homedir(), Math.random().toString(36).substring(2, 15) + Math.random().toString(23).substring(2, 5));

            this.terminalWriteLine("# ===========================================================");
            this.terminalWriteLine("#");

            if (process.platform === "win32") {
              for (let v in this.variables) {
                this.terminalWriteLine("$" + v + "='" + this.variables[v] + "'");
              }
            } else {
              for (let v in this.variables) {
                this.terminalWriteLine(v + "='" + this.variables[v] + "'");
              }
            }

            this.terminalWriteLine(a['install']);
            if (process.platform === "win32") {
              this.terminalWriteLine("$? | Out-File " + filename + " -Encoding ASCII");
            } else {
              this.terminalWriteLine("echo $? > " + filename);
            }

            while (!require('fs').existsSync(filename)) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            const data = require('fs').readFileSync(filename, 'utf8').toString();
            require('fs').unlinkSync(filename);

            if (data.startsWith('True') || data.startsWith("0")) {
              a['status'] = 'verified';
              this.postMessage({ command: 'set-action-status', id: a['id'], status: 'verified' });
            } else {
              a['status'] = 'failed';
              this.postMessage({ command: 'set-action-status', id: a['id'], status: 'failed' });
            }
          } catch (e) {
            a['status'] = 'missing';
            this.postMessage({ command: 'set-action-status', id: a['id'], status: 'failed' });
          }
        }
      }
    } catch (e) {
      vscode.window.showInformationMessage('EXCEPTION: ' + e);
    }
  }

  private getActionList(data: any): any[] {
    let ret : any[] = [];
    if (typeof data === 'object') {
      if (data instanceof Array) {
        for (let i of data.keys()) {
          ret = ret.concat(this.getActionList(data[i]));
        }
      }
      else {
        if ('hidden' in data && data['hidden']) {
          return [];
        }

        if ('type' in data && data['type'] === 'action-row') {
          ret.push(data);
        } else {
          for (let key in data) {
            if (typeof data[key] === 'object' && data[key] instanceof Array) {
              ret = ret.concat(this.getActionList(data[key]));
            }
          }
        }
      }
    }
    return ret;
  }

  private processFormDefinition(data: any): boolean {

    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        for (let i = data.length - 1; i >= 0; i--) {
          if (this.processFormDefinition(data[i])) {
            data.splice(i, 1);
          }
        }
      }
      else {
        if ('platform' in data) {
            var platforms: string[] = (typeof data['platform'] === 'string') ? [ data['platform'] ] : data['platform'];
            if (!platforms.includes(process.platform)) {
                return true;
            }
        }

        // set initial value of all variables - now just assume we deal with combo
        if ('variable' in data) {
          this.variables[data['variable']] = data['items'][0];
        }

        for (let key in data) {
          if (typeof data[key] === 'object') {
            this.processFormDefinition(data[key]);
          }
        }
      }
    }
    return false;
  }

  private handleVariable(data: any, combo_id: string, value: string) {

    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        for (let i = data.length - 1; i >= 0; i--) {
          this.handleVariable(data[i], combo_id, value);
        }
      }
      else {
        if ('hidden' in data && data['hidden']) {
          return;
        }

        if ('id' in data && data['id'] === combo_id) {
          if ('variable' in data) {
            this.variables[data['variable']] = value;
            this.runStepsVerification();
          }
          return;
        }

        for (let key in data) {
          if (typeof data[key] === 'object') {
            this.handleVariable(data[key], combo_id, value);
          }
        }
      }
    }
  }

  private terminalWriteLine(line: string): void {
    if (this.terminal === undefined || this.terminal.exitStatus !== undefined) {
      this.terminal = (process.platform === "win32") ? vscode.window.createTerminal("Installer", "powershell") :
                                                       vscode.window.createTerminal("Installer");   
    }
    this.terminal.show();
    this.terminal.sendText(line);
}

  private context: vscode.ExtensionContext;
  private name: string;
  private formDefinition: any;
  private variables: any = {};
  // what is actually created here?
  private terminal: vscode.Terminal | undefined = undefined;
}
