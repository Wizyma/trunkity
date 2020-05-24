import execa from 'execa';
import chalk from 'chalk';

import Configuration from './configuration';

const { log } = console;

export default class Tooling extends Configuration {
  private _impacteds(changes: string[]) {
    return changes
      .map((change) => {
        return this.workspacesTree
          .map((tree) => tree.pathsToIncludes)
          .reduce((a, b) => a.concat(b), [])
          .filter((path) => change.includes(path));
      })
      .reduce((a, b) => a.concat(b), [])
      .filter((el, i, arr) => arr.indexOf(el) === i)
      .map((impacted) =>
        this.workspacesTree.filter((workspace) => {
          return workspace.pathsToIncludes.includes(impacted);
        }),
      )
      .reduce((a, b) => a.concat(b), [])
      .map((workspace) => workspace.name);
  }

  constructor() {
    super();
  }

  public getChangesWithoutAffecteds(ref: string) {
    const currentBrahnch = execa.commandSync('git branch --show-current').stdout;
    const changes = execa
      .commandSync(`git diff --name-only ${ref}..${currentBrahnch}`)
      .stdout.split('\n')
      .filter((value) => value !== '');

    return this._impacteds(changes);
  }

  public getChangesWithAffecteds(ref: string) {
    const currentBrahnch = execa.commandSync('git branch --show-current').stdout;
    const changes = execa
      .commandSync(`git diff --name-only ${ref}..${currentBrahnch}`)
      .stdout.split('\n')
      .filter((value) => value !== '');

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
