#!/usr/bin/env ts-node-script

import { resolve } from 'path';
import execa from 'execa';
import chalk from 'chalk';

const { log } = console;

interface PackageJSON  {
  name: string;
  workspaces: string[];
  scripts: {[key: string]: string};
  devDependencies: {[key: string]: string};
}

function checkIsAGitRepository() {
  const isAGitRepo = execa.commandSync('git rev-parse --is-inside-work-tree').stdout;

  return isAGitRepo === 'true';
}

function getRootPackage() {
  const isAGitRepo = checkIsAGitRepository();
  if(isAGitRepo) {
    const root = execa.commandSync('git rev-parse --show-toplevel').stdout;
    const packageJSON: PackageJSON = require(resolve(root, 'package.json'));

    return packageJSON;
  }

  log(chalk.red('This is not a git repository'))
  process.exit(0);
}

function isMonorepo(): boolean {
  const packageJson = getRootPackage();
  const errors = {
    noPackageJSON: 'No package json found, please run the command in a node repository',
    noWorkspace: 'No workspace found, this cannot be used outside of a monorepo',
  }

  if(!packageJson) {
    log(chalk.red(errors.noPackageJSON))
    return false;
  }

  if(!packageJson.workspaces) {
    log(chalk.red(errors.noWorkspace))
    return false;
  }

  return true;

}


export default function main() {
  const monorepo: boolean = isMonorepo();
  if(monorepo) {
    console.log(monorepo)
  }
}

main();

