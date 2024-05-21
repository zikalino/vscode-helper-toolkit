import * as vscode from 'vscode';
var styles: any = require("./webview/styles.html");
var stylesWorkbench: any = require("./webview/treeview-css.html");
var script: string = require("./webview/scripts.html");

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
    this.postMessage({ command: 'show', id: id});
  }

  public hideElement(id: string) {
    this.postMessage({ command: 'hide', id: id});
  }

  public disableElement(id: string) {
    this.postMessage({ command: 'disable', id: id});
  }

  public enableElement(id: string) {
    this.postMessage({ command: 'enable', id: id});
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

          <!-- XXX clean up and move to scripts.js -->
          <script type="module" src="${uiToolkitUri}"></script>

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

  private context: vscode.ExtensionContext;
  private name: string;
}
