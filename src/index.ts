#!/usr/bin/env node

import chalk from 'chalk';
import program from 'commander';

import Tooling from './tooling';

const { log } = console;

program
  .name('affected')
  .option('-a, --affected [since]', 'Get affected changes since given ref, (default: master)')
  .option('-t, --tree', 'Parse repository to get a json representation of the internal dependency tree')
  .option('-n, --namespace', 'Return the namespace of the monorepo')
  .option('-o, --only-changed [since]', 'Return only packages changes since given ref, (default: master)')
  .parse(process.argv)

if(program.affected) {
  const ref = typeof program.affected === 'string' ? program.affected : 'master';
  const tools = new Tooling();
  const { impacteds, changes } = tools.getChangesWithAffecteds(ref);
  
  if(impacteds.length === 0) {
    log(chalk.green('No affected changes inside the monorepo'))
  } else {
    log(chalk.green('Your changes to: '))
    changes.map(change => {
      log(chalk.green('- ' + change))
    })
    log(chalk.green('will have an impact on: '))
    impacteds.map(impact => {
      log(chalk.red('- - ' + impact))
    })
  }
}

if(program.tree) {
  const tools = new Tooling();
  const json = tools.workspacesTree.map(({ name, path, workspaceDependencies }) => ({
    name, 
    path, 
    workspaceDependencies,
  }))

  log(chalk.white(JSON.stringify(json, null, 2)))
}

if(program.namespace) {
  const tools = new Tooling();
  log(chalk.white(tools.rootPackage.name))
}

if(program.onlyChanged) {
  const ref = typeof program.onlyChanged === 'string' ? program.onlyChanged : 'master';
  const tools = new Tooling();
  /**
   * In the case of using lerna commands, and wanting to pipe to make several 
   * operations to the changed packaged, you would have to use the output of this
   * and transform it like 'replace('@'+tools.rootPackage.name, '*')' to construct a string similar to
   * '{namespace, *\/foo, *\/bar}'
   * 
   * the command could then be: lerna run test --scope '{namespace, *\/foo, *\/bar}'
   * can be really usefull in CI env, since the lerna command --since act weird sometimes.
   */
  const changes = tools.getChangesWithoutAffecteds(ref).join(',');

  log(chalk.white(changes))
}

