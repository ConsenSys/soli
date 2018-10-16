"use strict";

const fs = require('fs')
const parser = require('solidity-parser-antlr')
const graphviz = require('graphviz')
const { linearize } = require('c3-linearization')
const moment = require('moment')
const path = require('path')

export function inheritance(files, options) {
  if (files.length === 0) {
    console.log('No files were specified for analysis in the arguments. Bailing...')
    return
  }

  const digraph = graphviz.digraph('G')
  digraph.set('ratio', 'auto')
  digraph.set('page', '40')

  // for draggable
  const definition = { "contracts": new Array(), "inheritances": new Array() }

  for (let file of files) {

    let content
    try {
      content = fs.readFileSync(file).toString('utf-8')
    } catch (e) {
      if (e.code === 'EISDIR') {
        console.error(`Skipping directory ${file}`)
        continue
      } else throw e;
    }

    const ast = parser.parse(content)

    let contractName = null
    let cluster = null
    let dependencies = {}

    parser.visit(ast, {
      ContractDefinition(node) {
        contractName = node.name

        if (!digraph.getNode(contractName)) {
          let opts = {
            label: contractName,
            color: 'gray'
          }

          digraph.addNode(contractName)

          // for draggable
          definition.contracts.push(contractName)
        }


        dependencies[contractName] = node.baseContracts.map(spec =>
          spec.baseName.namePath
        )

        for (let dep of dependencies[contractName]) {
          if (!digraph.getNode(dep)) {
            let opts = {
              label: dep,
              color: 'gray'
            }

            digraph.addNode(dep)

            // for draggalbe
            definition.contracts.push(dep)
          }

          digraph.addEdge(contractName, dep)

          // for draggable
          definition.inheritances.push(contractName + "=>" + dep)
        }
      }
    })

    dependencies = linearize(dependencies, {reverse: true})
  }

  if (options.draggable) {
    try {
      // generate report
      const outputFileName = reportGenerate(definition)
  
      console.log()
      console.log("successfully generated!")
      console.log("open " + outputFileName + " in browser")
    } catch (e) {
      console.error(e)
      process.exit(1)
    }
  } else {
    console.log(digraph.to_dot())
  }
}

function reportGenerate(definition) {
  // remove CR, LE, and space from definition
  const outputJSON = JSON.stringify(definition).replace(/\r|\n|\s/g, '')

  // load jspulub and jquery
  const jsplumbDefaultsCss = fs.readFileSync(__dirname + '/../node_modules/jsplumb/css/jsplumbtoolkit-defaults.css').toString()
  const jsPlumbJs = fs.readFileSync(__dirname + '/../node_modules/jsplumb/dist/js/jsplumb.min.js').toString()
  const jquery = fs.readFileSync(__dirname + '/../node_modules/jquery/dist/jquery.min.js').toString()

  // load template html
  const template = fs.readFileSync(__dirname + '/../resources/template.html').toString()

  // generate file name.
  const m = moment()
  const timestamp = m.format('YYYYMMDDHHmmss')
  const outputFileName = 'inheritance_' + timestamp + '.html'

  // generate report
  let output = template.replace(/{{definition}}/g, outputJSON)
  output = output.replace(/{{jsplumbtoolkit-defaults.css}}/g, jsplumbDefaultsCss)
  output = output.replace(/{{jsplumb.min.js}}/g, jsPlumbJs)
  output = output.replace(/{{jquery.min.js}}/g, jquery)
  fs.writeFileSync(process.cwd() + path.sep + outputFileName, output)

  return outputFileName
}