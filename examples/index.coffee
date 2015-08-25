
yaml = require 'js-yaml'

examplesDir = require('path').join __dirname
listExamples = () ->
  files = require('fs').readdirSync examplesDir
  files = (f for f in files when f.indexOf('.yaml')!=-1)
  return files
getExample = (name) ->
  p = require('path').join examplesDir, name
  content = require('fs').readFileSync p, encoding:'utf-8'
  results = []
  yaml.safeLoadAll content, (doc) ->
    results.push doc
  results = results[0] if results.length == 1
  return results

buildExampleBundle = () ->
  examples = {}
  for name in listExamples()
    examples[name] = getExample name
  contents = JSON.stringify examples, null, 2

  dest = examplesDir+"/bundle.js"
  require('fs').writeFileSync dest, "window.fbpspec_examples = #{contents};";
  console.log "wrote #{dest}"

  dest = examplesDir+"/bundle.json"
  require('fs').writeFileSync dest, contents
  console.log "wrote #{dest}"



exports.bundle = buildExampleBundle
