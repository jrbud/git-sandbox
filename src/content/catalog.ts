import { loadContent } from './loader'
import sectionsJson from './sections.json'
import type { ContentCatalog } from './types'

/** Every level file under ./levels, bundled at build time. */
const conceptFiles = import.meta.glob<unknown>('./levels/*/*.json', {
  eager: true,
  import: 'default',
})

let catalog: ContentCatalog | undefined

/** The game's content, loaded and validated once on first use. */
export function getCatalog(): ContentCatalog {
  catalog ??= loadContent(sectionsJson, conceptFiles)
  return catalog
}
