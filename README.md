k
# Project Templates VSCode Extension

[Visual Studio code](https://code.visualstudio.com) extension that allows you to quickly create new projects based on custom templates.

Inspired by [this File Templates Extension](https://github.com/brpaz/vscode-file-templates-ext), which is itself inspired by [a similar Atom Extension](https://atom.io/packages/file-templates).

## Features

* Create a new project from a template directory
* Save the current project as a template directory
* Use customizable placeholders for easy interactive configuration


![demo](https://raw.githubusercontent.com/cantonios/vscode-project-templates/master/images/demofast.gif)

## Install

## Extension Settings

This extension contributes the following settings:

```ts
{
  // default directory containing project templates
  "projectTemplates.templatesDirectory": "",

  // activate placeholder substitution
  "projectTemplates.usePlaceholders": true,

  // activate optional blocks substitution
  "projectTemplates.useOptionalBlocks": true,

  // dictionary of default placeholder key-value pairs
  "projectTemplates.placeholders": {  },

  // regular expression to use for detecting placeholders
  "projectTemplates.placeholderRegExp": "#{(\\w+)(?:=([^}]*))?}"

  // regular expression to use for detecting optional blocks
  "projectTemplates.optionalBlockRegExp": "\\/\\/--\\s*BEGIN\\s+OPTIONAL:\\s+(\\w+)\\s*([\\s\\S]*?)(?:\\s*?)\\/\\/--\\s*END\\s+OPTIONAL:\\s+\\1"
}
```

## Known Issues

* None

## Release Notes

See [CHANGELOG](https://github.com/cantonios/vscode-project-templates/tree/master/CHANGELOG.md) for release notes.


## Usage

Extension commands can be executed from the Command Palette or from the context menu when selecting a folder.

<img src="https://raw.githubusercontent.com/cantonios/vscode-project-templates/master/images/commands.png" width="450" />
<img src="https://raw.githubusercontent.com/cantonios/vscode-project-templates/master/images/menu.png" width="250" />

### Creating a Project from a Template

* In VSCode, open a folder that will contain your new project.  Use the Command Palette to execute the command "Project: Create Project From Template".  A list of available templates should appear. Select the desired template.  The contents of the template will be copied to the current root workspace directory.
* If called from the context menu, the contents of the template will instead be copied to the selected folder.

### Saving a Project as a Template

* Create the desired template project in your current root workspace directory.  Use the Command Palette to execute the command "Project: Save Project As Template".  Enter the name for your template.  The contents of your root workspace directory will be copied to a new template folder.
* If called from the context menu, the contents of the selected folder will be copied to the new template folder.

## Placeholders

Variable placeholders can be used in templates in the following way:

```
Author: #{author=default}
Title:  #{title}
```

When a file is created from a template containing placeholders, the user is prompted for a value to enter.  Placeholders can also be used in filenames.
A default value for given placeholder can be provided that's limited to the template and has priority over global placeholders defined in `settings.json`

* Processing of placeholders can be deactivated by setting the extension property
  ```
  "projectTemplates.usePlaceholders": false
  ```
* The format of placeholders is governed by a configurable regular expression which can be set through
  ```
  "projectTemplates.placeholderRegExp":  "#{(\\w+)(?:=([^}]*))?}"
  ```
  The first capture group in the regular expression is used to idenfity the placeholder key and the optional second capture is used to get default value
* A set of common placeholder key-values pairs can be specified in a dictionary:
  ```
  "projectTemplates.placeholders": {
	   "author" : "John Smith",
	   "company": "Wonderful Widgets Inc."
  }
  ```
  These placeholders will be filled out when creating template but will not be replaced automatically.

## Optional blocks

```cmake
add_executable(#{TEST_EXECUTABLE=tests} tests.cpp)
target_link_libraries(tests PRIVATE lib)

//-- BEGIN OPTIONAL: includeCatch2
include(FetchContent)
FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG #{CATCH2_VERSION=3.4.0}
)
FetchContent_MakeAvailable(Catch2)

target_link_libraries(#{TEST_EXECUTABLE} PRIVATE Catch2::Catch2WithMain)
//-- END OPTIONAL: includeCatch2
```

When a file is created from a template containing optional blocks, the user is given a choice to include them before placeholders get processed.
Accepting one block with given title would make it get automatically accepted in other files as well

* Processing of optional blocks can be deactivated by setting the extension property
  ```
  "projectTemplates.useOptionalBlocks": false
  ```
* The format of optional blocks is governed by a configurable regular expression which can be set through
  ```
  "projectTemplates.optionalBlockRegExp":  "\\/\\/--\\s*BEGIN\\s+OPTIONAL:\\s+(\\w+)\\s*([\\s\\S]*?)(?:\\s*?)\\/\\/--\\s*END\\s+OPTIONAL:\\s+\\1"
  ```
  The first capture group in the regular expression is used to idenfity the block and the second capture is the content


## Templates Location

By default, this extension expects the project templates to be placed within the user's data directory for VSCode, which is OS-specific.  For the non-portable version of VSCode, this is typically
```
$HOME/.config/Code/User/ProjectTemplates                       # Linux
$HOME/Library/Application Support/Code/User/ProjectTemplates   # macOS
%APPDATA%\Code\User\ProjectTemplates                           # Windows
```
For the portable version of vscode, or if a `--user-data-dir` is specified at the command-line, the default template location is
```
$USER_DATA_DIR/User/ProjectTemplates
```

You can change the templates location by adding the following to your user or workspace settings:

```
"projectTemplates.templatesDirectory": "path/to/my/templates"
```
This path supports VSCode's predefined variables, such as `${env:HOME}`.

### Samples

A set of sample templates can be found [here](https://github.com/cantonios/vscode-project-templates/tree/master/templates)
