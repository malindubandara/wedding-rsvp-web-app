const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function loadTs(file, overrides = {}) {
  const filename = path.join(__dirname, '..', file)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const context = {
    module, exports: module.exports,
    require: name => name === '@/lib/rsvp' ? loadTs('lib/rsvp.ts') : require(name),
    Response, Request, URL, Buffer, AbortSignal, Error,
    fetch: globalThis.fetch,
    process: { env: {} },
    console: { error() {} },
    ...overrides,
  }
  vm.runInNewContext(code, context, { filename })
  return module.exports
}

module.exports = { loadTs, plain: value => JSON.parse(JSON.stringify(value)) }
