const sections = ['overview', 'category-rag', 'chat-statistics', 'rule-statistics', 'plan-and-execute', 'tools', 'mcp']

export function wikiSectionFromHash(hash: string): string | null {
  if (hash === '#ai-wiki' || hash === '#ai-wiki/') return 'overview'
  if (!hash.startsWith('#ai-wiki/')) return null
  const section = hash.slice('#ai-wiki/'.length)
  return sections.includes(section) ? section : 'overview'
}


export function pageFromHash(hash: string): 'dashboard' | 'transactions' | 'assistant' | 'reports' | 'wiki' {
  if (wikiSectionFromHash(hash)) return 'wiki'
  if (hash === '#reports') return 'reports'
  if (hash === '#assistant') return 'assistant'
  if (hash === '#transactions') return 'transactions'
  return 'dashboard'
}
