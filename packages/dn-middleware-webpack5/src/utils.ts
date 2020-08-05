import * as fs from "fs";
import * as path from "path";
import * as assert from "assert";
import globby from "globby";
import * as Dawn from "@dawnjs/types";

import { Env, IOpts } from "./types";

export const getExistFile = ({
  cwd,
  files,
  returnRelative,
}: {
  cwd: string;
  files: string[];
  returnRelative: boolean;
}) => {
  for (const file of files) {
    const absFilePath = path.join(cwd, file);
    if (fs.existsSync(absFilePath)) {
      return returnRelative ? file : absFilePath;
    }
  }
};

// ./src/foo.js => foo
const getFilenameByPath = (f: string) => path.basename(f).split(".")[0];

// format entry and template
const formatReglikeObject = (params: Record<string, string>) => {
  const paramsMap: Record<string, string> = {};
  if (typeof params === "string") {
    paramsMap[getFilenameByPath(params)] = params;
  } else if (Array.isArray(params)) {
    params.forEach((e: any) => {
      paramsMap[getFilenameByPath(e)] = e;
    });
  } else {
    Object.assign(paramsMap, params);
  }
  const nameFileList: Array<{ name: string; file: string }> = [];
  Object.entries(paramsMap).forEach(([nameExpr, fileExpr]) => {
    const files = globby.sync(fileExpr);
    files.forEach(file => {
      const paths = file.split("/").reverse().map(getFilenameByPath);
      const name = nameExpr.replace(/\((\d+)\)/g, (_, index) => {
        return paths[index];
      });
      nameFileList.push({ name, file });
    });
  });
  return nameFileList;
};

// Validate and format input opts
export const formatAndValidateOpts = (opts: Partial<IOpts>, ctx: Dawn.Context) => {
  const options = Object.assign({}, opts);

  // cwd
  options.cwd = options.cwd || ctx.cwd;

  // env
  const isLegalEnv = (e?: string) => ["development", "production"].includes(e);
  if (!isLegalEnv(options.env)) {
    let envMessage = "[webpack5] None `env` development|production is configured";
    if (isLegalEnv(process.env?.DN_ENV)) {
      options.env = process.env.DN_ENV as Env;
      envMessage += `, auto set to ${options.env} by using DN_ENV`;
    } else if (isLegalEnv(process.env?.NODE_ENV)) {
      options.env = process.env.NODE_ENV as Env;
      envMessage += `, auto set to ${options.env} by using NODE_ENV`;
    } else {
      // ctx.command == current pipe full-name: init/dev/build/publish/..
      options.env = ctx.command.includes("dev") ? "development" : "production";
      envMessage += `, auto set to \`${options.env}\` by using DN_CMD`;
    }
    ctx.console.warn(envMessage);
  }

  // entry
  if (
    !options.entry ||
    (Array.isArray(options.entry) && !options.entry?.length) ||
    (typeof options.entry === "object" && !Object.keys(options.entry)?.length)
  ) {
    options.entry = getExistFile({
      cwd: options.cwd,
      files: ["src/index.tsx", "src/index.ts", "src/index.jsx", "src/index.js"],
      returnRelative: true,
    });
  }
  assert.ok(options.entry, "[webpack5] No entry found, checkout guide for usage details.");
  options.entry = formatReglikeObject(options.entry as any);

  // if (
  //   !options.entry ||
  //   (Array.isArray(options.entry) && !options.entry?.length) ||
  //   (typeof options.entry === "object" && !Object.keys(options.entry)?.length)
  // ) {
  //   options.entry = getExistFile({
  //     cwd: options.cwd,
  //     files: ["src/index.tsx", "src/index.ts", "src/index.jsx", "src/index.js"],
  //     returnRelative: true,
  //   });
  // }

  // inject & append
  if (typeof options.inject === "string") options.inject = [options.inject];
  if (typeof options.append === "string") options.append = [options.append];

  return options as IOpts;
};
