import test from 'node:test'
import assert from 'node:assert/strict'
import { pageFromHash, wikiSectionFromHash } from '../../src/application/wikiNavigation.ts'

test('wiki bookmarks resolve the documented AI features', () => {
  for (const section of ['overview', 'category-rag', 'chat-statistics', 'rule-statistics', 'plan-and-execute', 'tools', 'mcp']) {
    assert.equal(wikiSectionFromHash(`#ai-wiki/${section}`), section)
  }
  assert.equal(wikiSectionFromHash('#ai-wiki'), 'overview')
})

test('unrelated routes do not open the wiki and unknown wiki sections recover safely', () => {
  assert.equal(wikiSectionFromHash(''), null)
  assert.equal(wikiSectionFromHash('#transactions'), null)
  assert.equal(wikiSectionFromHash('#ai-wiki/missing'), 'overview')
  assert.equal(wikiSectionFromHash('#ai-wiki/%'), 'overview')
  assert.equal(wikiSectionFromHash('#ai-wiki/category-rag/extra'), 'overview')
})


test('page routes preserve targets across wiki back and forward navigation', () => {
  const history = ['#assistant', '#ai-wiki/category-rag', '#transactions', '#reports', '#ai-wiki/tools', '#reports']
  assert.deepEqual(history.map(pageFromHash), ['assistant', 'wiki', 'transactions', 'reports', 'wiki', 'reports'])
  assert.equal(pageFromHash(''), 'dashboard')
  assert.equal(pageFromHash('#dashboard'), 'dashboard')
  assert.equal(pageFromHash('#unknown'), 'dashboard')
})
