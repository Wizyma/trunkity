#!/usr/bin/env node

import { resolve } from 'path';
import execa from 'execa';
import chalk from 'chalk';
import program from 'commander';
import fse from 'fs-extra';

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
  root: string;
  workspaceInfo: {
    name: string;
    path: string;
    workspacePath: string;
  }[]
  workspacesTree: {
    name: string,
    path: string,
    workspaceDependencies: string[],
    workspaceDependenciesByType: {
      dev: string[],
      peer: string[],
      direct: string[]
    },
    pathsToIncludes: string[]
  }[]
  
  private getRootPackage(): PackageJSON {
    if(this.isAGitRepository) {
      const packageJSON: PackageJSON = require(resolve(this.root, 'package.json'));
  
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

    if(!this.isAGitRepository) {
      process.exit(0)
    }

    this.root = execa.commandSync('git rev-parse --show-toplevel').stdout;
    this.isMonorepo = this.checkIsMonorepo();
    this.rootPackage = this.getRootPackage();

    if(!this.isMonorepo) {
      process.exit(0)
    }
  
    this.workspaceInfo = this
      .getWorkspacesInfo()
      // @ts-ignore
      .map(({ json, ...rest }) => ({
        ...rest
      }))
    this.workspacesTree = this.getWorkspaceTree();
  }

  getWorkspacesInfo() {
    const workspaces = this.rootPackage.workspaces;
    const dirsPath = workspaces.map(workspace => {
      if(workspace.includes('*')) {
        return `${this.root}/${workspace.replace('*', '')}`
      }
      return `${this.root}/${workspace}`
    });

    return dirsPath
      .map(dir => {
        return fse.readdirSync(dir).map(packagePath => {
          const fullPath = `${dir}/${packagePath}`;
          if(fullPath.includes('//')) {
            return fullPath.replace('//', '/')
          }
    
          return fullPath
        });
      })
      .reduce((a, b) => {
        return a.concat(b)
      }, [])
      .map(packagePath => {
        const json = fse.readJSONSync(`${packagePath}/package.json`, { throws: false });
        if(json) {
          return {
            json,
            name: json.name,
            path: packagePath,
            workspacePath: packagePath.replace(`${this.root}/`, '')
          }
        }

        return null
      })
      .filter(file => file !== null)
  }

  getWorkspaceTree() {
    return this.getWorkspacesInfo()
      // @ts-ignore
      .map(({ name, json, path }) => {
        const depsByType = {
          dev: [
            ...Object.keys(json?.devDependencies ?? {}),
          ].filter(dep => dep.includes(this.rootPackage.name)),
          peer: [
            ...Object.keys(json?.peerDependencies ?? {}),
          ].filter(dep => dep.includes(this.rootPackage.name)),
          direct: [
            ...Object.keys(json?.dependencies ?? {}),
          ].filter(dep => dep.includes(this.rootPackage.name)),
        }
        const deps = [
          ...Object.keys(json?.devDependencies ?? {}),
          ...Object.keys(json?.peerDependencies ?? {}),
          ...Object.keys(json?.dependencies ?? {}),
        ].filter(dep => dep.includes(this.rootPackage.name))
        .filter((el, i, arr) => arr.indexOf(el) === i)

        const pathsToIncludes = this.workspaceInfo.filter(info => deps.includes(info.name)).map(({ workspacePath }) => workspacePath)

        return {
          name,
          path,
          workspaceDependencies: deps,
          workspaceDependenciesByType: depsByType,
          pathsToIncludes,
        }
      })
  }
}

class MonorepoTooling extends Configuration {
  private getChanges() {
    const changes = execa.commandSync('git diff --name-only').stdout.split('\n').filter(value => value !== '')
    
    if(changes.length >= 1) {
      return changes;
    }

    log(chalk.grey('No changes detected'));
    log(chalk.grey('Exiting...'));
    process.exit(0)
  }

  constructor() {
    super()
  }

  main() {
    program
      .option('-a, --affected')
      .option('-t, --tree')
      .parse(process.argv)
    
    if(program.affected) {
      const changes = this.getChanges();
      console.log(changes);
      const impacteds = changes.map(change => {
        return this.workspacesTree
          .map(tree => tree.pathsToIncludes)
          .reduce((a, b) => a.concat(b), [])
          .filter(path => change.includes(path))
      })
        .reduce((a, b) => a.concat(b), [])
        .filter((el, i, arr) => arr.indexOf(el) === i)
        .map(impacted => this.workspacesTree.filter(workspace => {
          return workspace.pathsToIncludes.includes(impacted)
        }))
        .reduce((a, b) => a.concat(b), [])
        .map(workspace => workspace.name)
      
      log(chalk.green('Your changes to: '))
      changes.map(change => {
        log(chalk.green('- ' + change))
      })
      log(chalk.green('will have an impact on: '))
      impacteds.map(impact => {
        log(chalk.red('- - ' + impact))
      })
    }

    if(program.tree) {
      const json = this.workspacesTree.map(({ name, path, workspaceDependencies }) => ({
        name, 
        path, 
        workspaceDependencies,
      }))

      log(chalk.white(JSON.stringify(json, null, 2)))
    }
  }
}

const cli = new MonorepoTooling();
cli.main();

