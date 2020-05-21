import execa from 'execa';
import chalk from 'chalk';

import Configuration from './configuration';

const { log } = console;

export default class Tooling extends Configuration {
  public getChanges() {
    const changes = execa.commandSync('git diff --name-only').stdout.split('\n').filter(value => value !== '')
    
    if(changes.length >= 1) {
      return changes;
    }

    log(chalk.grey('No changes detected'));
    log(chalk.grey('Exiting...'));
    process.exit(1)
  }

  constructor() {
    super()
  }
}
