"use strict";
import fs, { promises as fsPromise } from "fs";
import fse from "fs-extra";
import inquirer from "inquirer";
import path, { join } from "path";
import { fileURLToPath } from "url";
import { logger } from "./helpers/loger.js";
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const COMPONENT_BASE_DIR = join(__dirname, "../", "src", "components");
const COMPONENT_BASE_DIR_ITEMS = ["atoms", "molecules", "organism"];
const DEFAULT_STORIES_TITLE = "Shared/Templates/Base";
const DEFAULT_CONST = "BaseTemplate";

// Base Template for the new component folder
// const ORIGIN = join(__dirname, "../", "src", "shared", "templates", "base");
const STYLED_COMPONENT_BASE_ORIGIN = join(
  __dirname,
  "./",
  "src",
  "shared",
  "templates",
  "base"
);

(async () => {
  //if name hase space means nested component(component name should be in camel case)
  let { type, ComponentName, cssType } = await getTypeAndNameOfComponent();

  let { Base, BaseArgs, Components, Component } =
    getAllComponentToMakeEvenNested({
      ComponentName,
      type,
      BaseDir: COMPONENT_BASE_DIR,
    });

  // Checking if (atoms,molecules,organism) folder are present in COMPONENT_BASE_DIR
  let componentBaseDirOk = await COMPONENT_BASE_DIR_OK({
    baseDir: COMPONENT_BASE_DIR,
    itemsToCheck: COMPONENT_BASE_DIR_ITEMS,
  });

  if (componentBaseDirOk) {
    // Prepare Path for index.js of each new Folders created inside and what to export from parent if nested so the application will still
    let folderToExportFrom = getPathToExportComponent({
      Base,
      BaseDir: COMPONENT_BASE_DIR,
      Component,
    });

    // create Component
    let origin = "";
    if (cssType === "styled-components") {
      origin = STYLED_COMPONENT_BASE_ORIGIN;
    }

    if (origin.length > 0) {
      logging("info", `Creating ${ComponentName}`);
      let componentCreated = await createCompo({
        type,
        origin: STYLED_COMPONENT_BASE_ORIGIN,
        Base,
        Component,
        folderToExportFrom,
        BaseDir: COMPONENT_BASE_DIR,
      });

      if (componentCreated) {
        logging("info", `${ComponentName} created in ${type}`);
      } else {
        // rollback
        rollback();
      }
    } else {
      logging("error", `CSS Type: ${cssType} not found`);
    }
  } else {
    // logging that COMPONENT_BASE_DIR is not Ok
    logging(
      "error",
      `Check if folder ${COMPONENT_BASE_DIR_ITEMS} with index.ts in each folder and in ${COMPONENT_BASE_DIR} is present in ${COMPONENT_BASE_DIR} `
    );
  }
  return;
})();

// ------------------------------------------------------------------------------------------------//

// utils

function makeFirstCharCapital(item) {
  let text = item.split(" ");
  // Making first char Capital
  for (let i = 0; i < text.length; i++) {
    text[i] = text[i][0].toUpperCase() + text[i].substr(1);
  }
  text = text.join(" ");
  return text;
}

function COMPONENT_BASE_DIR_OK({ baseDir, itemsToCheck }) {
  return new Promise(async (resolve, reject) => {
    let allFolderPresentInComponentBaseDir = false;
    let dirFiles = await fsPromise.readdir(baseDir);
    dirFiles.forEach((item, idx) => {
      if (item !== "index.ts") {
        if (itemsToCheck.includes(item)) {
          allFolderPresentInComponentBaseDir = true;
        } else {
          allFolderPresentInComponentBaseDir = false;
          resolve(allFolderPresentInComponentBaseDir);
          return;
        }
      }
    });
    resolve(allFolderPresentInComponentBaseDir);
    return;
  });
}

function getAllComponentToMakeEvenNested({ ComponentName, type, BaseDir }) {
  // Make 1st char of ComponentName capital even if nested as we following a nameing convention
  let Components = makeFirstCharCapital(ComponentName);

  // We are making sure that our code works for single and nested component by spliting it with sapces
  let BaseArgs = Components.split(" ");

  // Get Component Name, always the last string is Componenet as we are also making nested component
  let Component = Components.split(" ").pop();

  // removing component name from Base args as we dont want to change the Base template Folder file if file name matches
  BaseArgs.length = BaseArgs.length - 1;

  // adding type to BaseArgs so we can make the index.ts Path for nested or single component creation
  BaseArgs = [type, ...BaseArgs];

  // Making a Base FolderPath for the Component
  let Base = path.join(BaseDir, ...BaseArgs);

  return { Base, BaseArgs, Components, Component };
}

function createCompo({
  type,
  origin,
  Base,
  Component,
  folderToExportFrom,
  BaseDir,
}) {
  return new Promise(async (resolve, reject) => {
    // Create path for the
    mkDirByPathSync(`${Base}/${Component}`);

    // copy Base template
    let copied = fse.copySync(origin, `${Base}/${Component}`, {
      overwrite: false,
    });

    // Change "BaseTemplate" from the file content of newly created component to its name
    let madeChanges = await makeChangesToNewComponent(Base, Component);
    if (madeChanges) {
      logging("info", "Component Updated Created");
    } else {
      logging("error", "Error while making changes for Component");
    }

    logging("info", "Preparing Index to export component");
    let preparedIndex = await prepareParentIndexToExportComponent({
      exportsFrom: folderToExportFrom.exportsFrom,
    });
    if (preparedIndex.includes(false)) {
      resolve(false);
    } else {
      logging("info", "Done : Preparing Index to export component");
      logging(
        `info`,
        `Preparing ${BaseDir} index to export ${type} if not already done`
      );
      let preparedBaseIndex = await prepareBaseDirIndexToExportType({
        type,
        BaseDir,
      });
      if (!preparedBaseIndex) {
        resolve(false);
      } else {
        resolve(true);
      }
    }
  });
}

function prepareBaseDirIndexToExportType({ type, BaseDir }) {
  return new Promise(async (resolve, reject) => {
    let newExport = `export * from "./${type}";\n`;
    let result = newExport;
    const data = await fsPromise.readFile(BaseDir + "/" + "index.ts", "utf8");
    result = replaceAllSubstring(data, newExport, "") + newExport;
    try {
      await fsPromise.writeFile(BaseDir + "/" + "index.ts", result, "utf8");
      resolve(true);
    } catch (error) {
      logging("error", error);
      resolve(false);
    }
  });
}

function prepareParentIndexToExportComponent({ exportsFrom }) {
  return new Promise((resolve, reject) => {
    let indexExported = exportsFrom.map(async (item, idx) => {
      let indexPrepared = await prepareIndex(item);
      return indexPrepared;
      // console.log(existsSync(item.indexPath), item, indexPath);
    });
    Promise.all(indexExported).then((values) => {
      resolve(values);
    });
  });
}

function getPathToExportComponent({ Base, BaseDir, Component }) {
  let getListOfFolders = Base.replace(`${BaseDir}/`, "").split("/");
  let toAddExportfrom = getListOfFolders.reduce(
    (acc, item, idx) => {
      if (idx === 0) {
        // if idx===0 add Base to make valid and correct filePath for the Component
        acc.prev = path.join(BaseDir, acc.prev ? acc.prev : "", item);
      } else {
        acc.prev = path.join(acc.prev ? acc.prev : "", item);
      }
      let indexPath = path.join(acc.prev, "index.ts");
      let exportFrom =
        getListOfFolders[
          idx + 1 > getListOfFolders.length ? undefined : idx + 1
        ];
      exportFrom = exportFrom !== undefined ? exportFrom : Component;
      let toExport = `export * from "./${exportFrom}";\n`;
      let toAdd = {
        indexPath,
        toExport,
      };
      acc.exportsFrom.push(toAdd);
      return acc;
    },
    { prev: "", exportsFrom: [] }
  );
  return toAddExportfrom;
}

function mkDirByPathSync(targetDir, { isRelativeToScript = false } = {}) {
  const sep = path.sep;
  const initDir = path.isAbsolute(targetDir) ? sep : "";
  const baseDir = isRelativeToScript ? __dirname : ".";

  return targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(baseDir, parentDir, childDir);
    try {
      fs.mkdirSync(curDir);
    } catch (err) {
      if (err.code === "EEXIST") {
        // curDir already exists!
        return curDir;
      }

      // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
      if (err.code === "ENOENT") {
        // Throw the original parentDir error on curDir `ENOENT` failure.
        throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
      }

      const caughtErr = ["EACCES", "EPERM", "EISDIR"].indexOf(err.code) > -1;
      if (!caughtErr || (caughtErr && curDir === path.resolve(targetDir))) {
        throw err; // Throw if it's just the last created dir.
      }
    }

    return curDir;
  }, initDir);
}

function makeChangesToNewComponent(Base, Component) {
  return new Promise(async (resolve, reject) => {
    try {
      let dirFiles = await fsPromise.readdir(join(Base, Component));
      if (dirFiles) {
        dirFiles.forEach(async (item, idx) => {
          const data = await fsPromise.readFile(
            join(Base, Component, item),
            "utf8"
          );
          let result = replaceAllSubstring(data, DEFAULT_CONST, Component);
          let storiesTitle_ = Base.split(`${COMPONENT_BASE_DIR}/`)[1];
          storiesTitle_ = makeFirstCharCapital(storiesTitle_);
          if (item.includes("stories.tsx")) {
            result = replaceAllSubstring(
              result,
              DEFAULT_STORIES_TITLE,
              `Components/${storiesTitle_}/${Component}`
            );
          }
          await fsPromise.writeFile(
            join(Base, Component, item),
            result,
            "utf8"
          );
          resolve(true);
        });
      }
    } catch (err) {
      reject(false);
    }
  });
}

function replaceAllSubstring(str, find, replace) {
  return str.replaceAll(find, replace);
}
// With async/await:
export async function createIndexFile(f) {
  try {
    await fse.ensureFile(f);
    logging("info", `success! - ${f}`);
    return { created: true };
  } catch (err) {
    logging("error", err);
    return { created: false };
  }
}

async function prepareIndex({ indexPath, toExport }) {
  let indexFile = await createIndexFile(indexPath);
  if (indexFile.created) {
    let newExport = toExport;
    let result = newExport;
    const data = await fsPromise.readFile(indexPath, "utf8");
    result = replaceAllSubstring(data, newExport, "") + newExport;
    try {
      await fsPromise.writeFile(indexPath, result, "utf8");
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}

function getTypeAndNameOfComponent() {
  return new Promise(async (resolve, reject) => {
    let propmt = await inquirer.prompt([
      {
        type: "list",
        name: "type",
        message: "Type of Component ?",
        choices: ["atoms", "molecules", "organism"],
      },
      {
        type: "list",
        name: "cssType",
        message: "Choose CSS type from below ?",
        choices: ["styled-components"],
      },
      {
        name: "ComponentName",
        message:
          "Name of the Component (Put spaces in between if nested)\n Component:",
      },
    ]);
    resolve({ ...propmt });
  });
}

function logging(level, msg) {
  logger.log({
    level: level,
    message: msg,
  });
}
