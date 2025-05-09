'use strict';

import * as vscode from 'vscode';
import { WorkspaceConfiguration } from 'vscode';
import VariableResolver from './utilities/variableResolver';

import fs = require('fs');
import path = require('path');

import fsutils = require("./utilities/fsutils");
import fmutils = require("./utilities/fmutils");

/**
 * Main class to handle the logic of the Project Templates
 * @export
 * @class TemplateManager
 */
export default class ProjectTemplatesPlugin {

    /**
     * local copy of workspace configuration to maintain consistency between calls
     */
    config: WorkspaceConfiguration;
    econtext: vscode.ExtensionContext;

    constructor(econtext : vscode.ExtensionContext, config: WorkspaceConfiguration) {
        this.config = config;
        this.econtext = econtext;
    }

    /**
     * Updates the current configuration settings
     * @param config workspace configuration
     */
    public updateConfiguration(config : WorkspaceConfiguration) {
        this.config = config;
    }

    /**
     * Selects a workspace folder.  If args contains an fsPath, then it uses
     * that.  Otherwise, for single root workspaces it will select the root directory,
     * or for multi-root will present a chooser to select a workspace.
     * @param args 
     */
    public async selectWorkspace(args : any) : Promise<string> {

        let workspace : string = "";

        // check arguments
        if (args && args.fsPath) {
            workspace = args.fsPath;
        } else if (vscode.workspace.workspaceFolders) {
            // single or multi-root
            if (vscode.workspace.workspaceFolders.length === 1) {
                workspace = vscode.workspace.workspaceFolders[0].uri.fsPath;
            } else if (vscode.workspace.workspaceFolders.length > 1) {
                // choose workspace
                let ws = await vscode.window.showWorkspaceFolderPick();
                if (ws) {
                    workspace = ws.uri.fsPath;
                }
            }
        }
        return workspace;
    }

    /**
     * Returns a list of available project templates by reading the Templates Directory.
     * @returns list of templates found
     */
    public async getTemplates(): Promise<string[]> {

        await this.createTemplatesDirIfNotExists();

		let templateDir: string = await this.getTemplatesDir();
        
        let templates: string[] = fs.readdirSync(templateDir).map( function (item) {
			// ignore hidden folders
            if (!/^\./.exec(item)) {
                return fs.statSync(path.join(templateDir, item)).isDirectory ? item : null;
            }
            return null;
        }).filter(function (filename) {
            return filename !== null;
		}) as string[];
		
        return templates;
    }

    /**
     * Returns the templates directory location.
     * If no user configuration is found, the extension will look for
     * templates in USER_DATA_DIR/Code/ProjectTemplates.
     * Otherwise it will look for the path defined in the extension configuration.
     * @return the templates directory
     */
    public async getTemplatesDir(): Promise<string> {

        let dir = this.config.get('templatesDirectory', this.getDefaultTemplatesDir());
        if (!dir) {
            dir = path.normalize(this.getDefaultTemplatesDir());
            return Promise.resolve(dir);
        }

        // resolve path with variables
        const resolver = new VariableResolver();
        let rdir = await resolver.resolve(dir);
        dir = path.normalize(rdir);

        return Promise.resolve(dir);
    }

    /**
     * Returns the default templates location, which is based on the global storage-path directory.
     * @returns default template directory
     */
    private getDefaultTemplatesDir(): string {

        // extract from workspace-specific storage path
        let userDataDir = this.econtext.storagePath;

        if (!userDataDir) {
            // no workspace, default to OS-specific hard-coded path
            // switch (process.platform) {
            //     case 'linux':
            //         userDataDir = path.join(os.homedir(), '.config');
            //         break;
            //     case 'darwin':
            //         userDataDir = path.join(os.homedir(), 'Library', 'Application Support');
            //         break;
            //     case 'win32':
            //         userDataDir = process.env.APPDATA!;
            //         break;
            //     default:
            //         throw Error("Unrecognized operating system: " + process.platform);
            // }
            // userDataDir = path.join(userDataDir, 'Code', 'User', 'ProjectTemplates');

            // extract from log path
            userDataDir = this.econtext.logPath;
            let gggparent = path.dirname(path.dirname(path.dirname(path.dirname(userDataDir))));
            userDataDir = path.join(gggparent, 'User', 'ProjectTemplates');
        } else {
            // get parent of parent of parent to remove workspaceStorage/<UID>/<extension>
            let ggparent = path.dirname(path.dirname(path.dirname(userDataDir)));
            // add subfolder 'ProjectTemplates'
            userDataDir = path.join(ggparent, 'ProjectTemplates');
        }

        return userDataDir;
    }

    /**
     * Creates the templates directory if it does not exists
	 * @throws Error
     */
    public async createTemplatesDirIfNotExists() {
		let templatesDir = await this.getTemplatesDir();
		
		if (templatesDir && !fs.existsSync(templatesDir)) {
			try {
                fsutils.mkdirsSync(templatesDir, 0o775);
				fs.mkdirSync(templatesDir);
			} catch (err) {
				if (err.code !== 'EEXIST') {
					throw err;
				}
			}
		}
    }

    /**
     * Chooses a template from the set of templates available in the root 
     * template directory.  If none exists, presents option to open root
     * template folder.
     * 
     * @returns chosen template name, or undefined if none selected
     */
    public async chooseTemplate() : Promise<string | undefined> {
        
        // read templates
        let templates = await this.getTemplates();
        let templateRoot = await this.getTemplatesDir();

        if (templates.length === 0) {
            let optionGoToTemplates = <vscode.MessageItem> {
                title: "Open Templates Folder"
            };

            vscode.window.showInformationMessage("No templates found!", optionGoToTemplates).then(option => {
                // nothing selected
                if (!option) {
                    return;
                }

                fmutils.openFolderInExplorer(templateRoot);
            });

            return undefined;
        }

        // show the list of available templates.
        return vscode.window.showQuickPick(templates);
    }

    /**
     * Deletes a template from the template root directory
     * @param template name of template
     * @returns success or failure
     */
    public async deleteTemplate(template : string) {
        
        // no template, cancel
        if (!template) {
            return false;
        }
            
        let templateRoot = await this.getTemplatesDir();
        let templateDir : string = path.join(templateRoot, template);

        if (fs.existsSync(templateDir) && fs.lstatSync(templateDir).isDirectory()) {
            // confirm delete
            let success = await vscode.window.showQuickPick(["Yes", "No"], { 
                placeHolder: "Are you sure you wish to delete the project template '" + template + "'?"
            }).then(
                async (choice) => {
                    if (choice === "Yes") {
                        // delete template
                        // console.log("Deleting template folder '" + templateDir + "'");
                        let ds = await fsutils.deleteDir(templateDir).then(
                            (value : boolean) => {
                                return value;
                            },
                            (reason : any) => {
                                return Promise.reject(reason);
                            }
                        );
                        return ds;
                    } 
                    return false;
                },
                (reason : any) => {
                    console.log(reason);
                    return Promise.reject(reason);
                }
                );

            return success;
        }

        return false;
    }

    /**
     * Saves a workspace as a new template
     * @param  workspace absolute path of workspace
     * @returns  name of template
     */
    public async saveAsTemplate(workspace : string) {

        // ensure templates directory exists
        await this.createTemplatesDirIfNotExists();

        let projectName = path.basename(workspace);

        // ask for project name
        let inputOptions = <vscode.InputBoxOptions> {
            prompt: "Please enter the desired template name",
            value: projectName
        };
    
        // prompt user
        return await vscode.window.showInputBox(inputOptions).then(
            
            async filename => {
    
                // empty filename exits
                if (!filename) {
                    return undefined;
                }

                // determine template dir
                let template = path.basename(filename);
                let templateDir = path.join(await this.getTemplatesDir(), template);
                console.log("Destination folder: " + templateDir);
    
                // check if exists
                if (fs.existsSync(templateDir)) {
                    // confirm over-write
                    await vscode.window.showQuickPick(["Yes", "No"], {
                            placeHolder: "Template '" + filename + "' already exists.  Do you wish to overwrite?"
                        }).then(
                            async (choice) => {
                                if (choice === "Yes") {
                                    // delete original and copy new template folder
                                    await fsutils.deleteDir(templateDir);
                                    await fsutils.copyDir(workspace, templateDir);
                                }
                            },
                            (reason) => {
                                return Promise.reject(reason);
                            });
                } else {
                    // copy current workspace to new template folder
                    await fsutils.copyDir(workspace, templateDir);
                }

                return template;
            }
        );
    }

    /**
     * Processes file content, resolving optional blocks and placeholders if enabled.
     *
     * @param data - Buffer containing the file content to process
     * @param optionalBlockRegExp - RegExp to identify optional blocks (first capture group should be the block title)
     * @param placeholderRegExp - RegExp to identify placeholders (first capture group should be the key name)
     * @param globalPlaceholders dictionary of global placeholder key-value pairs defined in user settings
     * @param confirmedPlaceholders dictionary of placeholder key-value pairs that appeared in current template
     * @param blockDecisions dictionary of block titles and decision user made, false if the first block of that title was declined, true otherwise
     * @param usePlaceholders - Whether placeholder replacement should be performed
     * @param useOptionalBlocks - Whether optional blocks should be processed
     * @returns The processed file content as a Buffer, maintaining the original encoding
     */
    private async handleFileContents(
        data : Buffer,
        optionalBlockRegExp : RegExp,
        placeholderRegExp : RegExp,
        globalPlaceholders : {[placeholder: string] : string | undefined},
        confirmedPlaceholders : {[placeholder: string] : string | undefined},
        blockDecisions : {[title: string] : boolean | undefined},
        usePlaceholders: boolean,
        useOptionalBlocks: boolean
    ) : Promise<Buffer> {

        let str: string;
        let encoding: string = "utf8";

        let fconfig = vscode.workspace.getConfiguration('files');
        encoding = fconfig.get("files.encoding", "utf8");
        try {
            str = data.toString(encoding);
        } catch (Err) {
            // cannot decipher text from encoding, assume raw data
            return data;
        }

        if (useOptionalBlocks) {
            str = await this.resolveOptionalBlocks(str, optionalBlockRegExp, blockDecisions);
        }

        if (usePlaceholders) {
            str = await this.resolvePlaceholders(str, placeholderRegExp, globalPlaceholders, confirmedPlaceholders)
        }

        let out: Buffer = Buffer.from(str, encoding);
        return out;
    }

    /**
     * Handles optional blocks found within input data. Will prompt user wether they
     * should be kept, remove optional tags if yes and remove blocks if not
     *
     * @param data input data
     * @param optionalBlockRegExp regular expression to use for detecting
     *                            optional blocks.  The first capture group is used
     *                            as the block title.
     * @param blockDecisions dictionary of block titles and decision user made, false if the first block of that title was declined, true otherwise
     * @returns the (potentially) modified data, with the same type as the input data
     */
    private async resolveOptionalBlocks(
        data : string,
        optionalBlockRegExp : RegExp,
        blockDecisions : {[title: string] : boolean | undefined}
    ) : Promise<string> {
        let processedStr : string = data;
        let optionalMatch;

        while (optionalMatch = optionalBlockRegExp.exec(processedStr)) {
            optionalBlockRegExp.lastIndex = 0;

            const block = optionalMatch[0];
            const title = optionalMatch[1].replace(/["']/g, '');
            const content = optionalMatch[2];

            if (blockDecisions[title]) {
                processedStr = processedStr.replace(block, content);
                continue
            } else if(blockDecisions[title] === false) {
                processedStr = processedStr.replace(block, '');
                continue
            }

            const includeSection = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: `Include section "${title}"?`
            });

            if (includeSection === 'Yes') {
                // Keep the content but remove the optional tags
                processedStr = processedStr.replace(block, content);
                blockDecisions[title] = true;
            } else {
                // Remove the optional section from the output
                processedStr = processedStr.replace(block, '');
                blockDecisions[title] = false;
            }
        }
        return processedStr;
    }

    /**
     * Replaces any placeholders found within the input data.  Will use a
     * dictionary of values from the user's workspace settings, or will prompt
     * if value is not known.
     *
     * @param data input data
     * @param placeholderRegExp  regular expression to use for detecting
     *                           placeholders.  The first capture group is used
     *                           as the key.
     * @param globalPlaceholders dictionary of global placeholder key-value pairs defined in user settings
     * @param globalPlaceholders dictionary of placeholder key-value pairs that appeared in current template
     * @returns the (potentially) modified data, with the same type as the input data
     */
    private async resolvePlaceholders(
        data : string,
        placeholderRegExp : RegExp,
        globalPlaceholders : {[placeholder: string] : string | undefined},
        confirmedPlaceholders : {[placeholder: string] : string | undefined},
    ) : Promise<string> {

        // collect set of expressions and their replacements
        let match;
        let nmatches = 0;
        let str : string = data;

        while ((match = placeholderRegExp.exec(str))) {
            const placeholder = match[1];
            let defaultValue : string | undefined = match[2];

            // Only prompt for placeholders that haven't appeared yet
            if (!confirmedPlaceholders[placeholder]) {
                const initialValue : string = defaultValue || globalPlaceholders[placeholder] || '';
                let variableInput = <vscode.InputBoxOptions>{
                    prompt: `Please enter the desired value for "${placeholder}"`,
                    value: initialValue // Set default value in the input box
                };

                const value = await vscode.window.showInputBox(variableInput)
                if (value) {
                    confirmedPlaceholders[placeholder] = value;
                } else if (globalPlaceholders[placeholder]) {
                    // If user cancels but a global value exists, use that
                    confirmedPlaceholders[placeholder] = globalPlaceholders[placeholder];
                }
            }
            ++nmatches;
        }

        // reset regex
        placeholderRegExp.lastIndex = 0;

        // compute output
        if (nmatches > 0) {
            // replace placeholders in string
            str = str.replace(placeholderRegExp,
                (match, key) => {
                    let val = confirmedPlaceholders[key];
                    if (!val) {
                        val = match;
                    }
                    return val;
                }
            );
        }

        return str;
    }

    /**
     * Populates a workspace folder with the contents of a template
     * @param workspace current workspace folder to populate
     */
    public async createFromTemplate(workspace : string) {

        await this.createTemplatesDirIfNotExists();

        // choose a template
        let template = await this.chooseTemplate();
        if (!template) {
            return;
        }

        // get template folder
        let templateRoot = await this.getTemplatesDir();
        let templateDir = path.join(templateRoot, template);

        if (!fs.existsSync(templateDir) || !fs.lstatSync(templateDir).isDirectory()) {
            vscode.window.showErrorMessage("Template '" + template + "' does not exist.");
            return undefined;
        }

        // update placeholder configuration
        let usePlaceholders : boolean = this.config.get("usePlaceholders", false);
        let useOptionalBlocks : boolean = this.config.get("useOptionalBlocks", false);

        const optionalBlockRegex : string = this.config.get("optionalBlockRegExp", "\\/\\/--\\s*BEGIN\\s+OPTIONAL:\\s+(\\w+)\\s*([\\s\\S]*?)(?:\\s*?)\\/\\/--\\s*END\\s+OPTIONAL:\\s+\\1");
        const placeholderRegex : string = this.config.get("placeholderRegex", "#{([A-Za-z0-9_]+)(?:=([^}]*))?}");

        const optionalBlockRegExp : RegExp = RegExp(optionalBlockRegex, 'g')
        const placeholderRegExp : RegExp = RegExp(placeholderRegex, 'g')

        let globalPlaceholders : {[placeholder:string] : string|undefined} = this.config.get("placeholders", {});
        let confirmedPlaceholders : {[placeholder:string] : string|undefined} = {};
        let blockDecisions : {[title:string] : boolean|undefined} = {};

        // re-read configuration, merge with current list of placeholders
        let newplaceholders : {[placeholder : string] : string} = this.config.get("placeholders", {});
        for (let key in newplaceholders) {
            globalPlaceholders[key] = newplaceholders[key];
        }

        // recursively copy files, replacing placeholders as necessary
		let copyFunc = async (src : string, dest : string) => {

            // maybe replace placeholders in filename
            if (usePlaceholders) {
                dest = await this.resolvePlaceholders(dest, placeholderRegExp, globalPlaceholders, confirmedPlaceholders) as string;
            }

			if (fs.lstatSync(src).isDirectory()) {
                // create directory if doesn't exist
				if (!fs.existsSync(dest)) {
					fs.mkdirSync(dest);
				} else if (!fs.lstatSync(dest).isDirectory()) {
                    // fail if file exists
					throw new Error("Failed to create directory '" + dest + "': file with same name exists.");
				}
            } else {

                // ask before overwriting existing file
                while (fs.existsSync(dest)) {

                    // if it is not a file, cannot overwrite
                    if (!fs.lstatSync(dest).isFile()) {
                        let reldest = path.relative(workspace, dest);

                        let variableInput = <vscode.InputBoxOptions> {
                            prompt: `Cannot overwrite "${reldest}".  Please enter a new filename"`,
                            value: reldest
                        };
        
                        // get user's input
                        dest = await vscode.window.showInputBox(variableInput).then(
                            value => {
                                if (!value) {
                                    return dest;
                                }
                                return value;
                            }
                        );

                        // if not absolute path, make workspace-relative
                        if (!path.isAbsolute(dest)) {
                            dest = path.join(workspace, dest);
                        }

                    } else {
                        
                        // ask if user wants to replace, otherwise prompt for new filename
                        let reldest = path.relative(workspace, dest);
                        let choice = await vscode.window.showQuickPick(["Overwrite", "Rename", "Skip", "Abort"], {
                            placeHolder: `Destination file "${reldest}" already exists.  What would you like to do?`
                        });

                        if (choice === "Overwrite") {
                            // delete existing file
                            fs.unlinkSync(dest);
                        } else if (choice === "Rename") {
                            // prompt user for new filename
                            let variableInput = <vscode.InputBoxOptions> {
                                prompt: "Please enter a new filename",
                                value: reldest
                            };

                            // get user's input
                            dest = await vscode.window.showInputBox(variableInput).then(
                                value => {
                                    if (!value) {
                                        return dest;
                                    }
                                    return value;
                                }
                            );

                            // if not absolute path, make workspace-relative
                            if (!path.isAbsolute(dest)) {
                                dest = path.join(workspace, dest);
                            }
                        } else if (choice === "Skip") {
                            // skip
                            return true;
                        } else {
                            // abort
                            return false;
                        }// overwrite or rename
                    }  // if file
                } // while file exists

                // get src file contents
                let fileContents : Buffer = fs.readFileSync(src);

                fileContents = await this.handleFileContents(
                    fileContents, optionalBlockRegExp, placeholderRegExp, globalPlaceholders, confirmedPlaceholders, blockDecisions, usePlaceholders, useOptionalBlocks
                );

                // ensure directories exist
                let parent = path.dirname(dest);
                fsutils.mkdirsSync(parent);

                // write file contents to destination
                fs.writeFileSync(dest, fileContents);

            }
            return true;
        };  // copy function
        
        // actually copy the file recursively
        await this.recursiveApplyInDir(templateDir, workspace, copyFunc);    
        
        return template;
    }

    /**
    * Recursively apply a function on a pair of files or directories from source to dest.
    * 
    * @param src source file or folder
    * @param dest destination file or folder
    * @param func function to apply between src and dest
    * @return if recursion should continue
    * @throws Error if function fails
    */
   private async recursiveApplyInDir(src : string, dest : string, 
        func : (src : string, dest : string) => Promise<boolean>) : Promise<boolean> {
   
        // apply function between src/dest
        let success = await func(src, dest);
        if (!success) {
            return false;
        }
   
        if (fs.lstatSync(src).isDirectory()) {
            
            // read contents of source directory and iterate
            const entries : string[] = fs.readdirSync(src);
    
            for(let entry of entries) {
                
                // full path of src/dest
                const srcPath = path.join(src,entry);
                const destPath = path.join(dest,entry);
                
                // if directory, recursively copy, otherwise copy file
                success = await this.recursiveApplyInDir(srcPath, destPath, func);
                if (!success) {
                    return false;
                }
            }
        }

        return true;
   }

} // templateManager