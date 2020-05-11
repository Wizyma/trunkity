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

class Configuration {
  isAGitRepository: boolean;
  rootPackage: PackageJSON;
  isMonorepo: boolean;

  private getRootPackage(): PackageJSON {
    if(this.isAGitRepository) {
      const root = execa.commandSync('git rev-parse --show-toplevel').stdout;
      const packageJSON: PackageJSON = require(resolve(root, 'package.json'));
  
      return packageJSON;
    }
  
    log(chalk.red('This is not a git repository'))
    process.exit(0);
  }

  private checkIsMonorepo(): boolean {
    const packageJson = this.getRootPackage();
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

  constructor() {
    this.isAGitRepository = execa.commandSync('git rev-parse --is-inside-work-tree').stdout === 'true';
    this.rootPackage = this.getRootPackage();
    this.isMonorepo = this.checkIsMonorepo();

    if(!this.isMonorepo || !this.isAGitRepository) {
      process.exit(0)
    }
  }
}

class MonorepoTooling extends Configuration {
  private getChanged() {
    const changes = execa.commandSync('git diff --name-only').stdout.split('\n').filter(value => value !== '')
    
    if(changes.length >= 1) {
      return changes;
    }

    log(chalk.grey('No changed detected'));
    log(chalk.grey('Exiting...'));
    process.exit(0)
  }

  constructor() {
    super()
  }

  main() {
    const changes = this.getChanged();
    log(changes)
  }
}

const cli = new MonorepoTooling();
cli.main();

