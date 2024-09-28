import { verify } from 'crypto';
import * as vscode from 'vscode';
import { JSONPath } from 'jsonpath-plus';
const yaml = require('js-yaml');
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

  createPanel(formDefinition: any, iconPath: string|null = null) {


    this.processFormDefinition(formDefinition);
    
    var localDefinitionFilename = require('os').homedir() + '/updated-definition.yml';
    if (require('fs').existsSync(localDefinitionFilename)) {
      const overrideFormDefinition = yaml.load(require('fs').readFileSync(localDefinitionFilename, 'utf8'));

      // XXX - try to merge local form definition with given form definition
      var givenActionList = this.getActionList(formDefinition);
      var overrideActionList = this.getActionList(overrideFormDefinition);

      for (var i = 0; i < overrideActionList.length; i++) {
        var id = overrideActionList[i]['id'];

        for (var j = 0; j < givenActionList.length; j++) {
          if (givenActionList[j]['id'] === id) {
            if ('verify-override' in overrideActionList[i]) {
              givenActionList[j]['verify-override'] = overrideActionList[i]['verify-override'];
            }
            if ('update-override' in overrideActionList[i]) {
              givenActionList[j]['update-override'] = overrideActionList[i]['update-override'];
            }
            if ('install-override' in overrideActionList[i]) {
              givenActionList[j]['install-override'] = overrideActionList[i]['install-override'];
            }
            if ('uninstall-override' in overrideActionList[i]) {
              givenActionList[j]['uninstall-override'] = overrideActionList[i]['uninstall-override'];
            }
          }
        }
      }
    }


    this.formDefinition = formDefinition;
    if (iconPath !== null) {
      this.panel.iconPath = vscode.Uri.joinPath(
        this.context.extensionUri,
        iconPath
      );
    }

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
            this.queryDataSources(this.formDefinition);
            this.reconfigureVisibility(this.formDefinition);
            break;
          case 'select-folder':
            this.selectFolder(message.id);
            return;
          case 'dropdown-clicked':
            // vscode.window.showInformationMessage('DROPDOWN SELECTION: ' + message.id);
            //this.terminalWriteLine("# DROPDOWN CLICKED: " + message.combo_id + " " + message.id);
            this.handleFieldUpdate(message.combo_id, message.id);
            this.reconfigureVisibility(this.formDefinition);
            // XXX - only run when necessary
            //this.runStepsVerification();
            break;
          case 'radio-clicked':

            this.handleFieldUpdate(message.id, message.value);
            this.reconfigureVisibility(this.formDefinition);
            // XXX - only run when necessary
            //this.runStepsVerification();
            break;
          case 'input-changed':

            this.handleFieldUpdate(message.id, message.value);
            this.reconfigureVisibility(this.formDefinition);
            // XXX - only run when necessary
            //this.runStepsVerification();
            break;
          case 'action-scripts-save':
            this.saveStepScripts(message.id,
                                 message.script_verify,
                                 message.script_install,
                                 message.script_update,
                                 message.script_uninstall);
            return;
          case 'action-update':
            this.runStepReRun(message.id);
            return;
          case 'action-uninstall':
            this.runStepUninstall(message.id);
            return;
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

  public async runStepsVerification() {
    this.actionsVerify();
  }

  public runStepsInstallation() {
    this.actionsInstall();
  }

  public runStepReRun(step_id: string): void {
    this.actionReRun(step_id);
  }

  public runStepUninstall(step_id: string) {
    this.actionUninstall(step_id);
  }

  public updateTreeViewItems(items: any) {
    let populateMsg = {
      command: 'populate',
      data: items
    };
    this.postMessage(populateMsg);
  }

  public updateTreeViewDetails(layout: any) {
    let populateMsg = {
      command: 'details',
      data: layout
    };
    this.postMessage(populateMsg);
    this.treeViewDetailsDefinition = layout;
  }

  private saveStepScripts(stepId: string, scriptVerify: string, scriptInstall: string, scriptUpdate: string, scriptUninstall: string) {
    try {        
      let actionList: any[] = this.getActionList(this.formDefinition);
      this.terminalWriteLine("# SAVING SCRIPTS OF: " + stepId);
      for (let a of actionList) {
        if (a['id'] === stepId) {
          // create overrides if necessary
          if (a['verify'] !== scriptVerify) {
            a['verify-override'] = scriptVerify;
          }
          if (a['install'] !== scriptInstall) {
            a['install-override'] = scriptInstall;
          }
          if (a['update'] !== scriptUpdate) {
            a['update-override'] = scriptUpdate;
          }
          if (a['uninstall'] != scriptUninstall) {
            a['uninstall-override'] = scriptUninstall;
          }
        }
      }

      // save form definition
      var updated_definition = yaml.dump(this.formDefinition);
      require('fs').writeFile(require('os').homedir() + '/updated-definition.yml', updated_definition, (err: any) => {
        if (err) {
            console.log(err);
        }
    });
    } catch (e) {
      vscode.window.showInformationMessage('EXCEPTION: ' + e);
    }
  }

  //-------------------------------------------------------------------------------------------------------------------
  // actionsValidateInput()
  //
  // This function run verification list on all the actions.
  //
  //-------------------------------------------------------------------------------------------------------------------
  private async actionsValidateInput(data: any) {
    let actionList: any[] = this.getActionList(data);
    for (let a of actionList) {
      this.actionValidateInput(a);
    }
  }

  private actionValidateInput(action: any) {
    if ('consumes' in action) {
      // verify if all consumed variables are actually properly defined
      for (let i = 0; i < action['consumes'].length; i++) {
        let v = action['consumes'][i];
        let variableName = v['variable'];
        if (this.variables[variableName] === undefined) {

          if (('required' in v) && !v['required'])
            continue;

          if ('required-if' in v) {
            let variable = v['required-if']['variable'];
            let expected_value = v['required-if']['value'];
            let value = this.variables[variable];
            if (value !== expected_value)
              continue;
          }

          this.terminalWriteLine("# DISABLING ACTION" + action.id + ": " + variableName + " = " + this.variables[variableName]);
          this.postMessage({ command: 'set-action-disabled', id: action['id'], disabled: true });
          return;
        }
      }
    }

    this.terminalWriteLine("# ENABLING ACTION " + action.id);
    this.postMessage({ command: 'set-action-disabled', id: action['id'], disabled: false });
  }

  //-------------------------------------------------------------------------------------------------------------------
  // actionsVerify()
  //
  // This function run verification list on all the actions.
  //
  //-------------------------------------------------------------------------------------------------------------------
  private async actionsVerify() {
    try {
      let actionList: any[] = this.getActionList(this.formDefinition);
      actionList = actionList.concat(this.getActionList(this.treeViewDetailsDefinition));

      for (let a of actionList) {
        this.postMessage({ command: 'set-action-status', id: a['id'], status: 'waiting' });
      }

      for (let a of actionList) {
        this.actionVerify(a, true);
      }
    } catch (e) {
      vscode.window.showInformationMessage('EXCEPTION: ' + e);
    }
  }

  private actionVerify(action: any, printFailure: boolean) {
    const cp = require('child_process');
    try {
      var cmd = "";
      if ('consumes' in action) {
        // verify if all consumed variables are actually properly defined
        for (let i = 0; i < action['consumes'].length; i++) {
          let variableName = action['consumes'][i]['variable'];
          if (this.variables[variableName] === undefined) {
            return;
          }

          if (process.platform === "win32") {
              cmd += " $" + variableName + "='" + this.variables[variableName] + "';";
          } else {
              cmd += variableName + "='" + this.variables[variableName] + "';";
          }
        }
      }

      cmd += action['verify'];
      if (process.platform === "win32") {
        cp.execSync(cmd, { shell: 'powershell' });
      } else {
        cp.execSync(cmd, { shell: '/bin/bash' });
      }
      action['status'] = 'verified';
      this.postMessage({ command: 'set-action-status', id: action['id'], status: 'verified' });
    } catch (e: any) {
      if (printFailure) {
        var lines = e.toString().split(/\r?\n/);
        this.terminalWriteLine("# ===========================================================");
        for (var i = 0; i < lines.length; i++) {
          this.terminalWriteLine("# " + lines[i]);
        }
        this.terminalWriteLine("# ===========================================================");
      }

      action['status'] = 'missing';
      this.postMessage({ command: 'set-action-status', id: action['id'], status: 'failed' });
    }
  }

  //-------------------------------------------------------------------------------------------------------------------
  // actionsInstall()
  //
  // This function run installation on all the actions.
  //
  //-------------------------------------------------------------------------------------------------------------------
  private async actionsInstall() {
    try {
      let actionList: any[] = this.getActionList(this.formDefinition);
      actionList = actionList.concat(this.getActionList(this.treeViewDetailsDefinition));

      for (let a of actionList) {
        if (!('status' in a) || a['status'] !== 'verified') {
          if (!await this.runAction(a)) break;
        }
      }
    } catch (e) {
      vscode.window.showInformationMessage('EXCEPTION: ' + e);
    }
  }

  private async actionReRun(id: string) {
    try {
      let actionList: any[] = this.getActionList(this.formDefinition);
      actionList = actionList.concat(this.getActionList(this.treeViewDetailsDefinition));

      for (let a of actionList) {
        if (a['id'] === id) {
          await this.runAction(a);
        }
      }
    } catch (e) {
      vscode.window.showInformationMessage('EXCEPTION: ' + e);
    }
  }

  private async actionUninstall(id: string) {
    try {
        
      let actionList: any[] = this.getActionList(this.formDefinition);
      actionList = actionList.concat(this.getActionList(this.treeViewDetailsDefinition));

      for (let a of actionList) {
        if (a['id'] === id) {
          await this.runActionUninstall(a);
        }
      }
    } catch (e) {
      vscode.window.showInformationMessage('EXCEPTION: ' + e);
    }
  }

  private displayBannerStart(operation: string, action: string, banner: string | undefined, script: string) : void {
    this.terminalWriteLine("#============================================================");
    this.terminalWriteLine("# " + operation + ": " + action);
    this.terminalWriteLine("#------------------------------------------------------------");

    if (banner) {
      var lines: string[] = banner.toString().split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== "") {
          this.terminalWriteLine("# " + lines[i]);
        }
      }

      this.terminalWriteLine("#------------------------------------------------------------");
    }

    if (script) {
      var lines: string[] = script.toString().split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== "") {
          this.terminalWriteLine("#   " + lines[i]);
        }
      }
    }

    this.terminalWriteLine("#============================================================");
}

  private async waitForCompletion(action: any): Promise<void> {
    let filenameStatus = require('path').join(require("os").homedir(), Math.random().toString(36).substring(2, 15) + Math.random().toString(23).substring(2, 5));
    let filenameOutput = require('path').join(require("os").homedir(), Math.random().toString(36).substring(2, 15) + Math.random().toString(23).substring(2, 5));
    if (process.platform === "win32") {
      this.terminalWriteLine("$? | Out-File " + filenameStatus + " -Encoding ASCII");
    } else {
      this.terminalWriteLine("echo $? > " + filenameStatus);
    }

    while (!require('fs').existsSync(filenameStatus)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const data = require('fs').readFileSync(filenameStatus, 'utf8').toString();
    require('fs').unlinkSync(filenameStatus);

    this.terminalWriteLine("#============================================================");

    if (data.startsWith('True') || data.startsWith("0")) {
      action['status'] = 'verified';
      this.postMessage({ command: 'set-action-status', id: action['id'], status: 'verified' });
      this.terminalWriteLine("# Result: SUCCESS");
    } else {
      action['status'] = 'failed';
      this.postMessage({ command: 'set-action-status', id: action['id'], status: 'failed' });
      this.terminalWriteLine("# Result: FAILED");
    }
    this.terminalWriteLine("#============================================================");

  }

  private async runAction(action: any): Promise<boolean> {
    try { 
      this.displayBannerStart("Installing", action['id'], action['banner'], action['install']);

      var cmd = action['install'];

      if ('consumes' in action) {
        // verify if all consumed variables are actually properly defined
        for (let i = 0; i < action['consumes'].length; i++) {
          let v = action['consumes'][i];
          let variableName = v['variable'];
          if (this.variables[variableName] === undefined) {
            if ('required-if' in v) {
              // XXX - check condition
              let variable = v['required-if']['variable'];
              let expected_value = v['required-if']['value'];
              let value = this.variables[variable];
              if (value === expected_value) {
                this.terminalWriteLine("# MISSING VALUE: " + variableName);
                return false;
              }
            } else if (!('required' in v) || v['required']) {
              this.terminalWriteLine("# MISSING VALUE: " + variableName);
              return false;
            }
          }

          if (process.platform === "win32") {
            this.terminalWriteLine("$" + variableName + "='" + this.variables[variableName] + "'");
          } else {
            this.terminalWriteLine(variableName + "='" + this.variables[variableName] + "'");
          }

          if (('parameter' in v) && (this.variables[variableName] !== undefined)) {
            if ('include-if' in v) {
              let variable = v['include-if']['variable'];
              let expected_value = v['include-if']['value'];
              let value = this.variables[variable];
              if (value === expected_value) {
                cmd += " " + v['parameter'];
              }
            } else {
              cmd += " " + v['parameter'];
            }
          }
        }
      }
      this.postMessage({ command: 'set-action-status', id: action['id'], status: 'installing' });


      let filenameOutput = require('path').join(require("os").homedir(), Math.random().toString(36).substring(2, 15) + Math.random().toString(23).substring(2, 5));
      if (process.platform === "win32") {
        this.terminalWriteLine(cmd + " | Out-File " + filenameOutput + " -Encoding ASCII");
      } else {
        this.terminalWriteLine(cmd + " > " + filenameOutput);
      }

      await this.waitForCompletion(action);

      // Attempt to load JSON if we need to find some data from the command
      if ('produces' in action) {
        var resultData = require('fs').readFileSync(filenameOutput, "utf8");
        var resultData = JSON.parse(resultData);

        for (var i = 0; i < action['produces'].length; i++) {
          let variableName = action['produces'][i]['variable'];
          let variablePath = action['produces'][i]['path'];
          let variableValue = JSONPath({path: variablePath, json: resultData});
          this.variables[variableName] = variableValue;
          this.terminalWriteLine("# " + variableName + "=" + variableValue);
        }            
      }

      this.actionVerify(action, true);
      return true;
    } catch (e) {
      action['status'] = 'missing';
      this.postMessage({ command: 'set-action-status', id: action['id'], status: 'failed' });
      return false;
    }
  }

  private async runActionUninstall(action: any): Promise<boolean> {
    try { 
      this.postMessage({ command: 'set-action-status', id: action['id'], status: 'installing' });

      let filename = require('path').join(require("os").homedir(), Math.random().toString(36).substring(2, 15) + Math.random().toString(23).substring(2, 5));

      this.displayBannerStart("Uninstalling", action['id'], undefined, action['uninstall']);

      if ('consumes' in action) {
        if (process.platform === "win32") {
          for (let v in this.variables) {
            if (this.consumesIncludes(action['consumes'], v)) {
              this.terminalWriteLine("$" + v + "='" + this.variables[v] + "'");
            }
          }
        } else {
          for (let v in this.variables) {
            if (this.consumesIncludes(action['consumes'], v)) {
              this.terminalWriteLine(v + "='" + this.variables[v] + "'");
            }
          }
        }
      }

      if ('uninstall' in action) {
        this.terminalWriteLine(action['uninstall']);
      } else {
        this.terminalWriteLine("# not implemented");
      }
      
      await this.waitForCompletion(action);
      this.terminalWriteLine("# verifying action after uninstallation");
      this.actionVerify(action, false);
      this.terminalWriteLine("# finished verification");
      return true;

    } catch (e) {
    }
    action['status'] = 'missing';
    this.postMessage({ command: 'set-action-status', id: action['id'], status: 'failed' });
    return true;
  }

  //-------------------------------------------------------------------------------------------------------------------
  // getActionList()
  //
  // This function returns list of all actions that are not hidden from the form
  //
  //-------------------------------------------------------------------------------------------------------------------
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

  //-------------------------------------------------------------------------------------------------------------------
  // getItemsWithDataSource()
  //
  // This function returns list of all items that require date query.
  // Currently these are:
  //  - dropdowns
  //
  //-------------------------------------------------------------------------------------------------------------------
  private getItemsWithDataSource(data: any): any[] {
    let ret : any[] = [];
    if (typeof data === 'object') {
      if (data instanceof Array) {
        for (let i of data.keys()) {
          ret = ret.concat(this.getItemsWithDataSource(data[i]));
        }
      }
      else {
        if ('hidden' in data && data['hidden']) {
          return [];
        }

        if ('source' in data) {
          ret.push(data);
        } else {
          for (let key in data) {
            if (typeof data[key] === 'object' && data[key] instanceof Array) {
              ret = ret.concat(this.getItemsWithDataSource(data[key]));
            }
          }
        }
      }
    }
    return ret;
  }

  private id_idx: number = 1;
  private ids = new Set();
  private getNextAutoId() {
    var auto_id = "";
    do {
      auto_id = "auto_" + (this.id_idx++).toString();
    } while (auto_id in this.ids);
    return auto_id;
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

        if ('type' in data && !('id' in data)) {
          if (!('id' in data)) {
            data['id'] = this.getNextAutoId();
          }
          this.ids.add(data['id']);      
        }

        // set initial value of all variables - now just assume we deal with combo
        if ('produces' in data) {
          if ('items' in data && data['items'].length > 0) {
            for (var i = 0; i < data['produces'].length; i++) {
              this.updateVariable(data['produces'][i]['variable'], data['items'][0]);
            }
          }
        }

        // XXX - fix default
        if (('variable' in data) && ('default' in data) && data['default']) {
          this.variables[data['variable']] = data['value'];
        }
          

        for (let key in data) {
          if (!key.startsWith("$")) {
            if (typeof data[key] === 'object') {
              this.processFormDefinition(data[key]);
            }
          }
        }
      }
    }
    return false;
  }

  private handleFieldUpdate(field_id: string, value: any) {
    let variableName = undefined;
    let variableValue = value;
    let field = this.findField(this.formDefinition, field_id);
    let hidden = false;
    if (field === undefined) {
      field = this.findField(this.formDefinition, field_id, true);
      hidden = true;
    }

    if (field !== undefined) {
      //this.terminalWriteLine("# handling variable in: " + id + " " + value);
      // XXX - this should be obsoleted
      if ('variable' in field) {
        if (('regex' in field) && !value.match(field['regex'])) {
          variableValue = undefined;
        }
        variableName = field['variable'];
        if (!hidden) {
          this.updateVariable(variableName, variableValue);
        }
      }

      // setting additional variables based on selection
      if ('produces' in field) {
        for (var i = 0; i < field['produces'].length; i++) {
          let curName = field['produces'][i]['variable'];
          let curValue = value;
          if (!('path' in field['produces'][i])) {
            // there's no path given, meaning we are going to store main value
            variableName = curName;
            if (('regex' in field['produces'][i]) && !curValue.match(field['produces'][i]['regex'])) {
              variableValue = undefined;
            }

            if (variableValue == "") {
              variableValue = undefined;
            }
            this.postMessage({ command: 'set-input-invalid', id: field_id, invalid: (variableValue === undefined) });    
            if (!hidden) {
              this.updateVariable(variableName, variableValue);
            } else {
              field['produces'][i]['$cached-value'] = variableValue;
            }
          } else {
            let variablePath = field['produces'][i]['path'];
            let itemData = undefined;
            if (variableValue !== undefined) {
              //this.terminalWriteLine("# PRODUCES: " + variableName + " " + variablePath + " " + value);
              for (var j = 0; j < field['$data'].length; j++) {
                // XXX - this is wrong -- it doesn't have to be name
                if (field['$data'][j]['name'] === variableValue) {
                  itemData = field['$data'][j];
                  break;
                }
              }
              variableValue = JSONPath({path: variablePath, json: itemData});
              //this.terminalWriteLine("# VALUE: " + variableValue);
            }
          }

          if (!hidden) {
            this.updateVariable(curName, variableValue);
          } else {
            field['produces'][i]['$cached-value'] = variableValue;
          }
        }        
      }    
    }
  }

  private updateVariable(name: string, value: any) {

    if (this.variables[name] !== value) {
      this.variables[name] = value;

      // requery relevant data sources
      if (value !== undefined) {
        // XXX - probably should be called if undefined as well
        this.queryDataSources(this.formDefinition, name);
      }

      // revalidate input in any case
      this.actionsValidateInput(this.formDefinition);

      // XXX - write to terminal as well
      if (process.platform === "win32") {
        this.terminalWriteLine("$" + name + "='" + this.variables[name] + "'");
      } else {
        this.terminalWriteLine(name + "='" + this.variables[name] + "'");
      }
    }
  }

  private findField(data: any, id: string, hidden: boolean = false): any {

    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        for (let i = data.length - 1; i >= 0; i--) {
          var found: any = this.findField(data[i], id);
          if (found !== undefined) {
            return found;
          }
        }
      }
      else {
        if (!hidden && ('hidden' in data) && data['hidden']) {
          return undefined;
        }

        if ('id' in data && data['id'] === id) {
          return data;
        }

        for (let key in data) {
          if (!key.startsWith("$")) {
            if (typeof data[key] === 'object') {
              var found = this.findField(data[key], id);
              if (found !== undefined) {
                return found;
              }
            }
          }
        }
      }
    }
    return undefined;
  }

  private reconfigureVisibility(data: any) {

    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        for (let i = data.length - 1; i >= 0; i--) {
          this.reconfigureVisibility(data[i]);
        }
      }
      else {

        if ('show-if' in data) {

          // get variable
          let variable = data['show-if']['variable'];
          let expected_value = data['show-if']['value'];
          let value = this.variables[variable];
          let hidden = ('hidden' in data) && data['hidden'];
          //vscode.window.showInformationMessage('UPDATING show-if: '  + variable + " " + value + " " + expected_value);

          if (value === expected_value) {
            if (hidden) {
              this.showElement(data['id']);
              this.syncVariables(data, true);
            }
          } else {
            if (!hidden) {
              this.hideElement(data['id']);
              this.syncVariables(data, false);
            }
          }
        }

        // don't continue to children if hidden
        if ('hidden' in data && data['hidden']) {
          return;
        }

        for (let key in data) {
          if (!key.startsWith("$")) {
            if (typeof data[key] === 'object') {
              this.reconfigureVisibility(data[key]);
            }
          }
        }
      }
    }
  }

  private syncVariables(data: any, visible: boolean) {
    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        for (let i = data.length - 1; i >= 0; i--) {
          this.syncVariables(data[i], visible);
        }
      }
      else {
        if ('produces' in data) {
          for (var i = 0; i < data['produces'].length; i++) {
            if (!visible) {
              if (data['produces'][i]['variable'] in this.variables) {
                data['produces'][i]['$cached-value'] = this.variables[data['produces'][i]['variable']];
              }
              this.updateVariable(data['produces'][i]['variable'], undefined);
            } else {
              if ('$cached-value' in data['produces'][i]) {
                this.updateVariable(data['produces'][i]['variable'], data['produces'][i]['$cached-value']);
              }
            }
          }
        }

        for (let key in data) {
          if (!key.startsWith("$")) {
            if (typeof data[key] === 'object') {
              this.syncVariables(data[key], visible);
            }
          }
        }
      }
    }
  }

  private queryDataSources(data: any, variable: string="") {
    try {
      let itemList: any[] = this.getItemsWithDataSource(data);

      for (let a of itemList) {
        if (this.queryCount < 10) {
          this.queryDataSource(a, true, variable);
        } else {
          //this.terminalWriteLine("# ATTEMPT TO QUERY " + variable + " BUT " + this.queryCount.toString() + " PENDING");
        }
      }
    } catch (e) {
      vscode.window.showInformationMessage('EXCEPTION: ' + e);
    }
  }

  private queryDataSource(item: any, printFailure: boolean, variable: string="") {
    const cp = require('child_process');

    try {
      var cmd = "";
      if ('consumes' in item) {

        // verify if all consumed variables are actually properly defined
        for (let i = 0; i < item['consumes'].length; i++) {
          let variableName = item['consumes'][i]['variable'];
          if (this.variables[variableName] === undefined) {
            return;
          }

          if (process.platform === "win32") {
              cmd += " $" + variableName + "='" + this.variables[variableName] + "';";
          } else {
              cmd += variableName + "='" + this.variables[variableName] + "';";
          }
        }
      }

      cmd += item['source']['cmd'];

      var out = "{}";
      var shell = "";
      if (process.platform === "win32") {
        shell = "powershell";
      } else {
        shell = "/bin/bash"
      }

      if ((variable === '') || (('consumes' in item) && this.consumesIncludes(item['consumes'], variable))) {
        //this.terminalWriteLine('# QUERY DATA SOURCE ' + variable + " ");
        
        // clear items
        this.postMessage({ command: 'set-items', id: item['id'], items: [] });

        this.queryCount++;
        this.postMessage({ command: 'set-field-busy', id: item['id'], busy: true });    

        cp.exec(cmd, { shell: shell }, (error: Error, out: string, stderr: string) => {
          this.queryCount--;
          this.postMessage({ command: 'set-field-busy', id: item['id'], busy: false });    

          //this.terminalWriteLine('# DATA SOURCE RESPONSE' + out.toString());
          //this.terminalWriteLine('# ERROR' + error.toString());
          //this.terminalWriteLine('# stderr' + stderr.toString());

          out = JSON.parse(out.toString());

          // store all the data for later use
          item['$data'] = out;

          var ids = JSONPath({path: item['source']['path-id'], json: out});
          var names = JSONPath({path: item['source']['path-name'], json: out});
    
          item['items'] = [];
          for (var idx in ids) {
            item['items'].push({ id: ids[idx], label: names[idx]});
          }
    
          this.postMessage({ command: 'set-items', id: item['id'], items: item['items'] });
        });
      }
    } catch (e: any) {
      if (printFailure) {
        vscode.window.showInformationMessage('QUERY EXCEPTION ' + e.toString());
        var lines = e.toString().split(/\r?\n/);
        this.terminalWriteLine("# ===========================================================");
        for (var i = 0; i < lines.length; i++) {
          this.terminalWriteLine("# " + lines[i]);
        }
        this.terminalWriteLine("# ===========================================================");
      }
    }
  }

  private consumesIncludes(consumes: any[], v: string) : boolean {
    for (var i = 0; i < consumes.length; i++) {
      if (consumes[i]['variable'] === v) {
        return true;
      }
    }
    return false;
  }

  private terminalWriteLine(line: string): void {
    if (terminal === undefined || terminal.exitStatus !== undefined) {
      terminal = (process.platform === "win32") ? vscode.window.createTerminal("Installer", "powershell") :
                                                  vscode.window.createTerminal("Installer");   
    }
    terminal.show();
    terminal.sendText(line);
  }

  private context: vscode.ExtensionContext;
  private name: string;
  private formDefinition: any;
  private treeViewDetailsDefinition: any = {};
  private variables: any = {};
  private queryCount = 0;
  // what is actually created here?
}

var terminal: vscode.Terminal | undefined = undefined;
