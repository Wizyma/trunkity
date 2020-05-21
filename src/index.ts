#!/usr/bin/env node

import chalk from 'chalk';
import program from 'commander';

import Tooling from './tooling';

const { log } = console;

program
  .option('-a, --affected')
  .option('-t, --tree')
  .parse(process.argv)

if(program.affected) {
  const tools = new Tooling();
  const changes = tools.getChanges();
  const impacteds = changes.map(change => {
    return tools.workspacesTree
      .map(tree => tree.pathsToIncludes)
      .reduce((a, b) => a.concat(b), [])
      .filter(path => change.includes(path))
  })
    .reduce((a, b) => a.concat(b), [])
    .filter((el, i, arr) => arr.indexOf(el) === i)
    .map(impacted => tools.workspacesTree.filter(workspace => {
      return workspace.pathsToIncludes.includes(impacted)
    }))
    .reduce((a, b) => a.concat(b), [])
    .map(workspace => workspace.name)
  
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

