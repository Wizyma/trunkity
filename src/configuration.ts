import { resolve } from 'path';
import execa from 'execa';
import chalk from 'chalk';
import fse from 'fs-extra';

const { log } = console;

export interface PackageJSON  {
  name: string;
  workspaces: string[];
  scripts: {[key: string]: string};
  devDependencies: {[key: string]: string};
}

export default class Configuration {
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
    process.exit(1);
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
      process.exit(1)
    }

    this.root = execa.commandSync('git rev-parse --show-toplevel').stdout;
    this.isMonorepo = this.checkIsMonorepo();
    this.rootPackage = this.getRootPackage();

    if(!this.isMonorepo) {
      process.exit(1)
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
        const dev = Object.keys(json?.devDependencies ?? {});
        const peer = Object.keys(json?.peerDependencies ?? {});
        const direct = Object.keys(json?.dependencies ?? {});
        const depsByType = {
          dev: [
            ...dev,
          ].filter(dep => dep.includes(this.rootPackage.name)),
          peer: [
            ...peer,
          ].filter(dep => dep.includes(this.rootPackage.name)),
          direct: [
            ...direct,
          ].filter(dep => dep.includes(this.rootPackage.name)),
        }
        const deps = [
          ...dev,
          ...peer,
          ...direct,
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