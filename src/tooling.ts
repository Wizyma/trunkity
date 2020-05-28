import execa from 'execa';
import chalk from 'chalk';

import Configuration from './configuration';

const { log } = console;

export default class Tooling extends Configuration {
  private _getChangedPackages(changes: string[]) {
    return changes
      .map((change) => this.workspacesTree.filter((tree) => change.includes(tree.path)))
      .reduce((a, b) => a.concat(b), [])
      .map((changed) => changed.name);
  }

  private _impacteds(changes: string[]) {
    return changes
      .map((change) => {
        return this.workspacesTree
          .map((tree) => tree.pathsToIncludes)
          .reduce((a, b) => a.concat(b), [])
          .filter((path, i, arr) => arr.indexOf(path) === i && change.includes(path));
      })
      .reduce((a, b) => a.concat(b), [])
      .map((impacted) =>
        this.workspacesTree.filter((workspace) => {
          return workspace.pathsToIncludes.includes(impacted);
        }),
      )
      .reduce((a, b) => a.concat(b), [])
      .map((workspace) => workspace.name);
  }

  private _getChanges(ref: string) {
    if (process.env.CI) {
      if (process.env.CI_COMMIT_SHA) {
        return execa
          .commandSync(`git diff-tree --no-commit-id --name-only -r ${process.env.CI_COMMIT_SHA}`)
          .stdout.split('\n')
          .filter((value) => value !== '');
      }
      log(chalk.gray('Only github ci is supported, please open a pull request'));
      process.exit(1);
    }

    return execa
      .commandSync(`git diff --name-only ${ref}..${this.currentBranch}`)
      .stdout.split('\n')
      .filter((value) => value !== '');
  }

  constructor() {
    super();
  }

  public getChangesWithoutAffecteds(ref: string) {
    const changes = this._getChanges(ref);
    return this._getChangedPackages(changes);
  }

  public getChangesWithAffecteds(ref: string) {
    const changes = this._getChanges(ref);

    if (changes.length >= 1) {
      const impacteds = this._impacteds(changes);

      return {
        impacteds,
        changes,
      };
    }

    log(chalk.grey('No changes detected'));
    log(chalk.grey('Exiting...'));
    process.exit(1);
  }
}
